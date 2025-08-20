<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/_param_norm_find_shared.php';
// ↑ Put the common normalization + "find" code you have in param_submit_simple
//   into this file (or paste the helpers directly here). For brevity, I’ll inline
//   just the essentials below.

$dbPath = __DIR__ . '/../data/results.sql3';

try {
  if (!file_exists($dbPath)) { http_response_code(500); echo json_encode(['error'=>'Database not found']); exit; }

  $pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);

  // ---------- read JSON ----------
  $raw = file_get_contents('php://input') ?: '';
  $in  = json_decode($raw, true);
  if (!is_array($in)) { http_response_code(400); echo json_encode(['error'=>'Invalid JSON']); exit; }

  // ---------- helpers (same as in submit) ----------
  $percentish_to_fraction = function($v, string $field): float {
    if ($v === null || $v === '') throw new InvalidArgumentException("$field missing");
    if (is_string($v)) { $v = trim($v); if ($v !== '' && substr($v, -1) === '%') $v = substr($v, 0, -1); }
    if (!is_numeric($v)) throw new InvalidArgumentException("$field not numeric");
    $x = (float)$v;
    if ($x < 0) throw new InvalidArgumentException("$field negative");
    if ($x <= 1.0)  return round($x, 12);
    if ($x <= 100)  return round($x / 100.0, 12);
    throw new InvalidArgumentException("$field too large ($x)");
  };
  $toFrac = static function(float $x): float { return $x > 1.0 ? round($x/100.0, 12) : round($x, 12); };
  $norm = static function(?string $s): string {
    $s = trim((string)$s);
    $s = preg_replace('/\s+/u', ' ', $s);
    return mb_strtolower($s, 'UTF-8');
  };

  // ---------- normalize payload ----------
  $scenario_id    = (int)($in['scenario_id']   ?? 1);
  $earliest_year  = (int)($in['earliest_year'] ?? 2030);
  $latest_year    = (int)($in['latest_year']   ?? 2050);
  $phaseout_thr_f = $percentish_to_fraction(($in['phaseout_thresh'] ?? 90), 'phaseout_thresh');

  $w_dom_sent = (float)($in['w_dom_energy']  ?? 33.3);
  $w_gov_sent = (float)($in['w_gov_revenue'] ?? 33.3);
  $w_emp_sent = (float)($in['w_employment']  ?? 33.3);

  if (isset($in['w_dom_energy_frac'], $in['w_gov_revenue_frac'], $in['w_employment_frac'])) {
    $w_dom_f = max(0.0, min(1.0, round((float)$in['w_dom_energy_frac'], 12)));
    $w_gov_f = max(0.0, min(1.0, round((float)$in['w_gov_revenue_frac'], 12)));
    $w_emp_f = max(0.0, min(1.0, round((float)$in['w_employment_frac'], 12)));
  } else {
    $w_dom_f = $toFrac($w_dom_sent);
    $w_gov_f = $toFrac($w_gov_sent);
    $w_emp_f = $toFrac($w_emp_sent);
  }
  $wdf3  = round($w_dom_f, 3);
  $wgf3  = round($w_gov_f, 3);
  $wef3  = round($w_emp_f, 3);
  $pthf3 = round($phaseout_thr_f, 3);

  $scale_by_cap    = (int)($in['scale_dep_by_capacity'] ?? 0);
  $floating_budget = isset($in['floating_budget']) ? (int)$in['floating_budget'] : 1;

  // capacity preset resolution (match submit logic, but no writes)
  $cs         = is_array($in['capacity_settings'] ?? null) ? $in['capacity_settings'] : [];
  $capRaw     = (string)($cs['capacity_name'] ?? '');
  $capNorm    = $norm($capRaw);
  $offLike    = ($capNorm === '' || $capNorm === 'off');
  $capacity_settings_id = null;
  if ($offLike || $scale_by_cap === 0) {
    $capacity_settings_id = null;
    $scale_by_cap = 0;
  } else {
    $stmt = $pdo->prepare("
      SELECT capacity_settings_id
      FROM capacity_settings
      WHERE LOWER(TRIM(capacity_name)) = LOWER(TRIM(:name))
      ORDER BY capacity_settings_id ASC LIMIT 1
    ");
    $stmt->execute([':name'=>$capRaw]);
    $row = $stmt->fetch();
    if (!$row) { echo json_encode(['status'=>'missing','result_id'=>null]); exit; }
    $capacity_settings_id = (int)$row['capacity_settings_id'];
    $scale_by_cap = 1;
  }

  // ---------- find only ----------
  $capWhere = ($capacity_settings_id === null)
    ? "AND capacity_settings_id IS NULL"
    : "AND capacity_settings_id = :cap";

  $sql = "
    SELECT result_id, is_calculated
    FROM param_sets
    WHERE scenario_id = :scn
      AND earliest_year = :ey
      AND latest_year   = :ly
      AND ROUND( (CASE WHEN phaseout_thresh > 1.0000001 THEN phaseout_thresh/100.0 ELSE phaseout_thresh END), 3) = :pthf3
      AND ROUND( (CASE WHEN w_dom_energy    > 1.0000001 THEN w_dom_energy   /100.0 ELSE w_dom_energy    END), 3) = :wdf3
      AND ROUND( (CASE WHEN w_gov_revenue   > 1.0000001 THEN w_gov_revenue  /100.0 ELSE w_gov_revenue   END), 3) = :wgf3
      AND ROUND( (CASE WHEN w_employment    > 1.0000001 THEN w_employment   /100.0 ELSE w_employment    END), 3) = :wef3
      $capWhere
      AND scale_dep_by_capacity = :scale
      AND CAST(COALESCE(floating_budget, :fb) AS INTEGER) = CAST(:fb AS INTEGER)
    ORDER BY result_id ASC
    LIMIT 1
  ";
  $q = $pdo->prepare($sql);
  $q->bindValue(':scn',   $scenario_id, PDO::PARAM_INT);
  $q->bindValue(':ey',    $earliest_year, PDO::PARAM_INT);
  $q->bindValue(':ly',    $latest_year,   PDO::PARAM_INT);
  $q->bindValue(':pthf3', $pthf3);
  $q->bindValue(':wdf3',  $wdf3);
  $q->bindValue(':wgf3',  $wgf3);
  $q->bindValue(':wef3',  $wef3);
  $q->bindValue(':scale', $scale_by_cap,  PDO::PARAM_INT);
  $q->bindValue(':fb',    $floating_budget, PDO::PARAM_INT);
  if ($capacity_settings_id !== null) $q->bindValue(':cap', $capacity_settings_id, PDO::PARAM_INT);
  $q->execute();
  $row = $q->fetch();

  if ($row) {
    echo json_encode(['status' => ((int)$row['is_calculated']===1 ? 'ready':'pending'),
                      'result_id' => (int)$row['result_id'],
                      'is_calculated' => (int)$row['is_calculated']], JSON_UNESCAPED_UNICODE);
  } else {
    echo json_encode(['status'=>'missing','result_id'=>null], JSON_UNESCAPED_UNICODE);
  }

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error'=>$e->getMessage()]);
}
