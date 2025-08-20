
<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); 

$dbPath = __DIR__ . '/../data/results.sql3';

try {
  if (!file_exists($dbPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Database not found']);
    exit;
  }

  $pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);

  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Empty body']);
    exit;
  }
  $in = json_decode($raw, true);
  if (!is_array($in)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
  }

  // ---------- helpers ----------
  /**
   * Accepts 95, "95", "95%", 0.95 → returns 0.95
   * Rejects negatives and > 100 unless already [0..1].
   */
  $percentish_to_fraction = function($v, string $field) : float {
    if ($v === null || $v === '') {
      throw new InvalidArgumentException("$field missing");
    }
    if (is_string($v)) {
      $v = trim($v);
      if (substr($v, -1) === '%') {
        $v = substr($v, 0, -1);
      }
    }
    if (!is_numeric($v)) {
      throw new InvalidArgumentException("$field not numeric");
    }
    $x = (float)$v;
    if ($x < 0) {
      throw new InvalidArgumentException("$field negative");
    }
    // already fraction
    if ($x <= 1.0) {
      return round($x, 12);
    }
    // 0..100% to fraction
    if ($x <= 100.0) {
      return round($x / 100.0, 12);
    }
    // >100 only valid if it's clearly a fraction mistake
    throw new InvalidArgumentException("$field too large ($x)");
  };

  $null_if_missing = function($arr, string $key) {
    return array_key_exists($key, $arr) ? ($arr[$key] === '' ? null : $arr[$key]) : null;
  };

  // ---------- read + normalize payload ----------
  $scenario_id   = (int)($in['scenario_id']   ?? 1);
  $earliest_year = (int)($in['earliest_year'] ?? 2030);
  $latest_year   = (int)($in['latest_year']   ?? 2050);

  // FRACTIONS ONLY from here on
  $phaseout_thresh = $percentish_to_fraction(($in['phaseout_thresh'] ?? 90), 'phaseout_thresh');
  $w_dom_energy    = $percentish_to_fraction(($in['w_dom_energy']    ?? 33.3), 'w_dom_energy');
  $w_gov_revenue   = $percentish_to_fraction(($in['w_gov_revenue']   ?? 33.3), 'w_gov_revenue');
  $w_employment    = $percentish_to_fraction (($in['w_employment']   ?? 33.3), 'w_employment');

  $scale_by_capacity = (int)($in['scale_dep_by_capacity'] ?? 0);

  // ALWAYS decide a floating_budget for dedupe (default 1 = single budget)
  $floating_budget = isset($in['floating_budget']) ? (int)$in['floating_budget'] : 1;

  // capacity settings
  $cs         = is_array($in['capacity_settings'] ?? null) ? $in['capacity_settings'] : [];
  $cap_name   = trim((string)($cs['capacity_name'] ?? 'custom'));
  $low_thresh = $null_if_missing($cs, 'low_thresh')        !== null ? (int)$cs['low_thresh'] : null;
  $high_thresh= $null_if_missing($cs, 'high_thresh')       !== null ? (int)$cs['high_thresh'] : null;
  $interp     = $null_if_missing($cs, 'interp_btw_thresh') !== null ? (int)$cs['interp_btw_thresh'] : 0;
  $resp_since = $null_if_missing($cs, 'resp_since')        !== null ? (int)$cs['resp_since'] : null;
  $r_weight   = $null_if_missing($cs, 'r_weight')          !== null ? (float)$cs['r_weight'] : null;

  // Optional DEBUG echo to verify normalization (add ?debug=1 to request URL)
  $debug = isset($_GET['debug']) && $_GET['debug'] === '1';

  $pdo->beginTransaction();

  // ---------- 1) capacity_settings: reuse or insert (NULL-safe) ----------
  $selCap = $pdo->prepare("
    SELECT capacity_settings_id
    FROM capacity_settings
    WHERE capacity_name = :n
      AND COALESCE(low_thresh,        -1) = COALESCE(:lt, -1)
      AND COALESCE(high_thresh,       -1) = COALESCE(:ht, -1)
      AND COALESCE(interp_btw_thresh, -1) = COALESCE(:it, -1)
      AND COALESCE(resp_since,        -1) = COALESCE(:rs, -1)
      AND COALESCE(r_weight,          -1) = COALESCE(:rw, -1)
    LIMIT 1
  ");
  $selCap->execute([
    ':n'  => $cap_name,
    ':lt' => $low_thresh,
    ':ht' => $high_thresh,
    ':it' => $interp,
    ':rs' => $resp_since,
    ':rw' => $r_weight,
  ]);
  $cap = $selCap->fetch();

  if ($cap) {
    $cap_id = (int)$cap['capacity_settings_id'];
  } else {
    $insCap = $pdo->prepare("
      INSERT INTO capacity_settings
        (capacity_name, low_thresh, high_thresh, interp_btw_thresh, resp_since, r_weight)
      VALUES
        (:n, :lt, :ht, :it, :rs, :rw)
    ");
    $insCap->execute([
      ':n'  => $cap_name,
      ':lt' => $low_thresh,
      ':ht' => $high_thresh,
      ':it' => $interp,
      ':rs' => $resp_since,
      ':rw' => $r_weight,
    ]);
    $cap_id = (int)$pdo->lastInsertId();
  }

  // ---------- 2) param_sets de-dupe (use ONLY normalized vars) ----------
  $tol = 1e-9;

  $find = $pdo->prepare("
    SELECT result_id, is_calculated
    FROM param_sets
    WHERE scenario_id = :scn
      AND earliest_year = :ey
      AND latest_year   = :ly
      AND ABS(phaseout_thresh - :pth)  < :tol
      AND ABS(w_dom_energy  - :wd)     < :tol
      AND ABS(w_gov_revenue - :wg)     < :tol
      AND ABS(w_employment  - :we)     < :tol
      AND capacity_settings_id = :cap
      AND scale_dep_by_capacity = :scale
      AND floating_budget = :fb
    ORDER BY is_calculated DESC, result_id ASC
    LIMIT 1
  ");
  $find->execute([
    ':scn'   => $scenario_id,
    ':ey'    => $earliest_year,
    ':ly'    => $latest_year,
    ':pth'   => $phaseout_thresh,   // << normalized
    ':wd'    => $w_dom_energy,      // << normalized
    ':wg'    => $w_gov_revenue,     // << normalized
    ':we'    => $w_employment,      // << normalized
    ':cap'   => $cap_id,
    ':scale' => $scale_by_capacity,
    ':fb'    => $floating_budget,
    ':tol'   => $tol,
  ]);
  $existing = $find->fetch();

  if ($existing) {
    $result_id = (int)$existing['result_id'];
    $pdo->prepare("UPDATE param_sets SET date_last_used = strftime('%s','now') WHERE result_id = :rid")
        ->execute([':rid' => $result_id]);

    $pdo->commit();
    echo json_encode([
      'status'    => $existing['is_calculated'] ? 'ready' : 'pending',
      'result_id' => $result_id,
      'existing'  => true,
      'debug'     => $debug ? [
        'normalized' => [
          'phaseout_thresh' => $phaseout_thresh,
          'w_dom_energy'    => $w_dom_energy,
          'w_gov_revenue'   => $w_gov_revenue,
          'w_employment'    => $w_employment,
          'floating_budget' => $floating_budget
        ]
      ] : null
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $ins = $pdo->prepare("
    INSERT INTO param_sets
      (is_calculated, date_calculated, date_last_used,
       scenario_id, earliest_year, latest_year, phaseout_thresh,
       w_dom_energy, w_gov_revenue, w_employment,
       capacity_settings_id, scale_dep_by_capacity, floating_budget)
    VALUES
      (0, NULL, strftime('%s','now'),
       :scn, :ey, :ly, :pth,
       :wd, :wg, :we,
       :cap, :scale, :fb)
  ");
  $ins->execute([
    ':scn'   => $scenario_id,
    ':ey'    => $earliest_year,
    ':ly'    => $latest_year,
    ':pth'   => $phaseout_thresh,   // << normalized
    ':wd'    => $w_dom_energy,      // << normalized
    ':wg'    => $w_gov_revenue,     // << normalized
    ':we'    => $w_employment,      // << normalized
    ':cap'   => $cap_id,
    ':scale' => $scale_by_capacity,
    ':fb'    => $floating_budget,
  ]);
  $result_id = (int)$pdo->lastInsertId();

  $pdo->commit();

  echo json_encode([
    'status'    => 'pending',
    'result_id' => $result_id,
    'existing'  => false,
    'debug'     => $debug ? [
      'normalized' => [
        'phaseout_thresh' => $phaseout_thresh,
        'w_dom_energy'    => $w_dom_energy,
        'w_gov_revenue'   => $w_gov_revenue,
        'w_employment'    => $w_employment,
        'floating_budget' => $floating_budget
      ]
    ] : null
  ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}