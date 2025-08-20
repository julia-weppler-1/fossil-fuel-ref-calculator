<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // tighten in prod

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('html_errors', '0');
ini_set('log_errors', '1');
set_error_handler(function ($severity, $message, $file, $line) {
  if (!(error_reporting() & $severity)) return false;
  throw new ErrorException($message, 0, $severity, $file, $line);
});

$dbPath = __DIR__ . '/../data/results.sql3';

function ff(float $x): string {
  $s = rtrim(rtrim(number_format($x, 12, '.', ''), '0'), '.');
  return ($s === '' || $s === '-0') ? '0' : $s;
}

try {
  if (!file_exists($dbPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Database not found', 'dbPath' => $dbPath]);
    exit;
  }

  $pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  $pdo->exec("PRAGMA busy_timeout=3000");
  $pdo->exec("PRAGMA foreign_keys=ON");

  // ---------- read JSON ----------
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

  // ---------- debug ----------
  $debugOn = (isset($_GET['debug']) && $_GET['debug'] !== '0') || !empty($in['debug']);
  $debug = [
    'phase' => 'start',
    'notes' => [],
    'env'   => [
      'php_version' => PHP_VERSION,
      'request_uri' => $_SERVER['REQUEST_URI'] ?? null,
      'method'      => $_SERVER['REQUEST_METHOD'] ?? null,
    ],
  ];
  $dbg = function(string $msg) use (&$debug) {
    $debug['notes'][] = $msg;
    error_log('[param_submit_debug] '.$msg);
  };

  // ---------- DB context ----------
  $debug['db'] = [
    'path'    => $dbPath,
    'realpath'=> realpath($dbPath),
    'exists'  => file_exists($dbPath),
    'size'    => @filesize($dbPath),
    'mtime'   => @date('c', @filemtime($dbPath)),
  ];
  $debug['sqlite'] = [
    'version'      => $pdo->query('SELECT sqlite_version() v')->fetch()['v'] ?? null,
    'encoding'     => $pdo->query('PRAGMA encoding')->fetchColumn(),
    'user_version' => $pdo->query('PRAGMA user_version')->fetchColumn(),
  ];
  $tblInfo = $pdo->query('PRAGMA table_info(param_sets)')->fetchAll();
  $debug['table_info_param_sets'] = $tblInfo;

  // ---------- helpers ----------
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

  // ---------- read + normalize payload ----------
  $scenario_id    = (int)($in['scenario_id']   ?? 1);
  $earliest_year  = (int)($in['earliest_year'] ?? 2030);
  $latest_year    = (int)($in['latest_year']   ?? 2050);

  $phaseout_thr_f = $percentish_to_fraction(($in['phaseout_thresh'] ?? 90), 'phaseout_thresh');

  // weights (as sent % + normalized to fractions)
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

  // ---------- capacity preset resolution ----------
  $cs           = is_array($in['capacity_settings'] ?? null) ? $in['capacity_settings'] : [];
  $cap_in_raw   = (string)($cs['capacity_name'] ?? '');
  $cap_in_norm  = $norm($cap_in_raw);
  $offLike = ($cap_in_norm === '' || $cap_in_norm === 'off');

  $capacity_settings_id = null;
  if ($offLike || $scale_by_cap === 0) {
    $capacity_settings_id = null;
    $scale_by_cap = 0;
    if ($debugOn) $dbg("Capacity OFF path. cap_name='{$cap_in_raw}' => id=NULL, scale=0");
  } else {
    $stmt = $pdo->prepare("
      SELECT capacity_settings_id
      FROM capacity_settings
      WHERE LOWER(TRIM(capacity_name)) = LOWER(TRIM(:name))
      ORDER BY capacity_settings_id ASC
      LIMIT 1
    ");
    $stmt->execute([':name' => $cap_in_raw]);
    $row = $stmt->fetch();
    if (!$row) {
      http_response_code(400);
      echo json_encode(['error' => "capacity_name '{$cap_in_raw}' not found in capacity_settings. Send 'off' or seed it first."], JSON_UNESCAPED_UNICODE);
      exit;
    }
    $capacity_settings_id = (int)$row['capacity_settings_id'];
    $scale_by_cap = 1;
    if ($debugOn) $dbg("Capacity preset '{$cap_in_raw}' resolved to id={$capacity_settings_id}, scale=1");
  }

  if ($debugOn) {
    $debug['phase'] = 'normalized';
    $debug['raw_body'] = $raw;
    $debug['input'] = $in;
    $debug['normalized'] = [
      'scenario_id' => $scenario_id,
      'earliest_year' => $earliest_year,
      'latest_year' => $latest_year,
      'phaseout_thr_f' => $phaseout_thr_f,
      'w_dom_f' => $w_dom_f, 'w_gov_f' => $w_gov_f, 'w_emp_f' => $w_emp_f,
      'w_dom_sent' => $w_dom_sent, 'w_gov_sent' => $w_gov_sent, 'w_emp_sent' => $w_emp_sent,
      'capacity_settings_id' => $capacity_settings_id,
      'scale_by_cap' => $scale_by_cap,
      'floating_budget' => $floating_budget,
    ];
  }

  // ---------- MATCH (dedupe) ----------
  // ---------- MATCH (dedupe) ----------
$pdo->beginTransaction();

// canonical ints at 3dp (e.g., 0.333 -> 333, 0.9 -> 900)
$pth3i = (int)round($phaseout_thr_f * 1000);
$wd3i  = (int)round($w_dom_f        * 1000);
$wg3i  = (int)round($w_gov_f        * 1000);
$we3i  = (int)round($w_emp_f        * 1000);

$capWhere = ($capacity_settings_id === null)
  ? "AND capacity_settings_id IS NULL"
  : "AND capacity_settings_id = :cap";

$sql = "
  SELECT result_id, is_calculated
  FROM param_sets
  WHERE result_id >= 1
    AND scenario_id = :scn
    AND earliest_year = :ey
    AND latest_year   = :ly
    AND CAST(ROUND((CASE WHEN phaseout_thresh > 1.0000001
                         THEN phaseout_thresh/100.0 ELSE phaseout_thresh END) * 1000.0) AS INTEGER) = :pth3i
    AND CAST(ROUND((CASE WHEN w_dom_energy    > 1.0000001
                         THEN w_dom_energy   /100.0 ELSE w_dom_energy    END) * 1000.0) AS INTEGER) = :wd3i
    AND CAST(ROUND((CASE WHEN w_gov_revenue   > 1.0000001
                         THEN w_gov_revenue  /100.0 ELSE w_gov_revenue   END) * 1000.0) AS INTEGER) = :wg3i
    AND CAST(ROUND((CASE WHEN w_employment    > 1.0000001
                         THEN w_employment   /100.0 ELSE w_employment    END) * 1000.0) AS INTEGER) = :we3i
    $capWhere
    AND scale_dep_by_capacity = :scale
    AND CAST(COALESCE(floating_budget, :fb) AS INTEGER) = CAST(:fb AS INTEGER)
  ORDER BY result_id ASC
  LIMIT 1
";

if ($debugOn) {
  $debug['phase'] = 'before-find';
  $debug['find_sql'] = $sql;
  $debug['find_params'] =
    [
      ':scn'=>$scenario_id, ':ey'=>$earliest_year, ':ly'=>$latest_year,
      ':pth3i'=>$pth3i, ':wd3i'=>$wd3i, ':wg3i'=>$wg3i, ':we3i'=>$we3i,
      ':scale'=>$scale_by_cap, ':fb'=>$floating_budget
    ] + ($capacity_settings_id!==null ? [':cap'=>$capacity_settings_id] : []);

  $lit = $sql;
  $repl = [
    ':scn'=>(string)$scenario_id, ':ey'=>(string)$earliest_year, ':ly'=>(string)$latest_year,
    ':pth3i'=>(string)$pth3i, ':wd3i'=>(string)$wd3i, ':wg3i'=>(string)$wg3i, ':we3i'=>(string)$we3i,
    ':scale'=>(string)$scale_by_cap, ':fb'=>(string)$floating_budget,
  ];
  if ($capacity_settings_id !== null) $repl[':cap'] = (string)$capacity_settings_id;
  foreach ($repl as $k=>$v) $lit = str_replace($k, $v, $lit);
  $debug['find_sql_literal'] = $lit;
}

$find = $pdo->prepare($sql);
$find->bindValue(':scn',   $scenario_id, PDO::PARAM_INT);
$find->bindValue(':ey',    $earliest_year, PDO::PARAM_INT);
$find->bindValue(':ly',    $latest_year, PDO::PARAM_INT);
$find->bindValue(':pth3i', $pth3i, PDO::PARAM_INT);
$find->bindValue(':wd3i',  $wd3i,  PDO::PARAM_INT);
$find->bindValue(':wg3i',  $wg3i,  PDO::PARAM_INT);
$find->bindValue(':we3i',  $we3i,  PDO::PARAM_INT);
$find->bindValue(':scale', $scale_by_cap, PDO::PARAM_INT);
$find->bindValue(':fb',    $floating_budget, PDO::PARAM_INT);
if ($capacity_settings_id !== null) $find->bindValue(':cap', $capacity_settings_id, PDO::PARAM_INT);
$find->execute();
$existing = $find->fetch();


  // ---------- helper: compute deltas for a specific result row ----------
  $computeDeltas = function(array $row) use ($phaseout_thr_f, $w_dom_f, $w_gov_f, $w_emp_f): array {
    $wd = isset($row['w_dom_energy'])   ? ((float)$row['w_dom_energy'])   / 100.0 : null;
    $wg = isset($row['w_gov_revenue'])  ? ((float)$row['w_gov_revenue'])  / 100.0 : null;
    $we = isset($row['w_employment'])   ? ((float)$row['w_employment'])   / 100.0 : null;
    $pth= isset($row['phaseout_thresh'])? (float)$row['phaseout_thresh'] : null;

    return [
      'row' => [
        'result_id' => $row['result_id'] ?? null,
        'w_dom_energy' => $row['w_dom_energy'] ?? null,
        'w_gov_revenue'=> $row['w_gov_revenue'] ?? null,
        'w_employment' => $row['w_employment'] ?? null,
        'phaseout_thresh' => $row['phaseout_thresh'] ?? null,
        'typeof_wd' => $row['typeof_wd'] ?? null,
        'typeof_wg' => $row['typeof_wg'] ?? null,
        'typeof_we' => $row['typeof_we'] ?? null,
        'typeof_pth'=> $row['typeof_pth'] ?? null,
      ],
      'normalized_db' => ['wd'=>$wd,'wg'=>$wg,'we'=>$we,'pth'=>$pth],
      'incoming' => ['wd'=>$w_dom_f,'wg'=>$w_gov_f,'we'=>$w_emp_f,'pth'=>$phaseout_thr_f],
      'deltas' => [
        'd_wd' => ($wd===null)?null:abs($wd - $w_dom_f),
        'd_wg' => ($wg===null)?null:abs($wg - $w_gov_f),
        'd_we' => ($we===null)?null:abs($we - $w_emp_f),
        'd_pth'=> ($pth===null)?null:abs($pth - $phaseout_thr_f),
      ],
    ];
  };

  if ($existing) {
    $rid = (int)$existing['result_id'];
    $rowStmt = $pdo->prepare("
      SELECT
        result_id, scenario_id, earliest_year, latest_year,
        phaseout_thresh,
        w_dom_energy, w_gov_revenue, w_employment,
        typeof(phaseout_thresh) AS typeof_pth,
        typeof(w_dom_energy) AS typeof_wd,
        typeof(w_gov_revenue) AS typeof_wg,
        typeof(w_employment) AS typeof_we,
        capacity_settings_id, scale_dep_by_capacity, floating_budget
      FROM param_sets
      WHERE result_id = :rid
      LIMIT 1
    ");
    $rowStmt->execute([':rid' => $rid]);
    $fullRow = $rowStmt->fetch() ?: [];

    $deltaReport = $computeDeltas($fullRow);

    $pdo->prepare("UPDATE param_sets SET date_last_used = strftime('%s','now') WHERE result_id = :rid")
        ->execute([':rid' => $rid]);
    $pdo->commit();

    $resp = [
      'status'          => ((int)$existing['is_calculated'] === 1 ? 'ready' : 'pending'),
      'result_id'       => $rid,
      'existing'        => true,
      'cap_settings_id' => $capacity_settings_id,
    ];
    if ($debugOn) {
      $debug['phase'] = 'matched';
      $debug['matched_row_keys'] = $existing;
      $debug['matched_row_full'] = $fullRow;
      $debug['matched_row_delta_report'] = $deltaReport;

      // show candidates with same non-weight filters
      $ignoreWeightsSql = "
        SELECT result_id,
               scenario_id, earliest_year, latest_year,
               phaseout_thresh, w_dom_energy, w_gov_revenue, w_employment,
               typeof(phaseout_thresh) AS typeof_pth,
               typeof(w_dom_energy) AS typeof_wd,
               typeof(w_gov_revenue) AS typeof_wg,
               typeof(w_employment) AS typeof_we
        FROM param_sets
        WHERE scenario_id = :scn
          AND earliest_year = :ey
          AND latest_year   = :ly
          ".($capacity_settings_id===null ? "AND capacity_settings_id IS NULL" : "AND capacity_settings_id = :cap")."
          AND scale_dep_by_capacity = :scale
          AND CAST(COALESCE(floating_budget, :fb) AS INTEGER) = CAST(:fb AS INTEGER)
        ORDER BY result_id ASC
        LIMIT 50
      ";
      $iw = $pdo->prepare($ignoreWeightsSql);
      $iw->bindValue(':scn',   $scenario_id, PDO::PARAM_INT);
      $iw->bindValue(':ey',    $earliest_year, PDO::PARAM_INT);
      $iw->bindValue(':ly',    $latest_year, PDO::PARAM_INT);
      $iw->bindValue(':scale', $scale_by_cap, PDO::PARAM_INT);
      $iw->bindValue(':fb',    $floating_budget, PDO::PARAM_INT);
      if ($capacity_settings_id !== null) $iw->bindValue(':cap', $capacity_settings_id, PDO::PARAM_INT);
      $iw->execute();
      $iwRows = $iw->fetchAll();
      $debug['candidates_ignore_weights'] = $iwRows;

      $nearest = [];
      foreach ($iwRows as $r) {
        $nearest[] = $computeDeltas($r);
      }
      usort($nearest, function($a,$b){
        $da = ($a['deltas']['d_wd']??9)+($a['deltas']['d_wg']??9)+($a['deltas']['d_we']??9)+($a['deltas']['d_pth']??9);
        $db = ($b['deltas']['d_wd']??9)+($b['deltas']['d_wg']??9)+($b['deltas']['d_we']??9)+($b['deltas']['d_pth']??9);
        return $da <=> $db;
      });
      $debug['nearest_by_weights_top5'] = array_slice($nearest, 0, 5);
      $resp['debug'] = $debug;
    }

    echo json_encode($resp, JSON_UNESCAPED_UNICODE);
    exit;
  }

  // ---------- NO MATCH: diagnostics ----------
  if ($debugOn) {
    $diagSql = "
      SELECT
        result_id,
        scenario_id, earliest_year, latest_year,
  
        -- integerized 3dp values from DB
        CAST(ROUND((CASE WHEN phaseout_thresh > 1.0000001
                         THEN phaseout_thresh/100.0 ELSE phaseout_thresh END) * 1000.0) AS INTEGER) AS pth3i_db,
        CAST(ROUND((CASE WHEN w_dom_energy    > 1.0000001
                         THEN w_dom_energy   /100.0 ELSE w_dom_energy    END) * 1000.0) AS INTEGER) AS wd3i_db,
        CAST(ROUND((CASE WHEN w_gov_revenue   > 1.0000001
                         THEN w_gov_revenue  /100.0 ELSE w_gov_revenue   END) * 1000.0) AS INTEGER) AS wg3i_db,
        CAST(ROUND((CASE WHEN w_employment    > 1.0000001
                         THEN w_employment   /100.0 ELSE w_employment    END) * 1000.0) AS INTEGER) AS we3i_db,
  
        :pth3i AS pth3i_req, :wd3i AS wd3i_req, :wg3i AS wg3i_req, :we3i AS we3i_req,
  
        CASE WHEN scenario_id = :scn THEN 1 ELSE 0 END AS ok_scn,
        CASE WHEN earliest_year = :ey THEN 1 ELSE 0 END AS ok_ey,
        CASE WHEN latest_year   = :ly THEN 1 ELSE 0 END AS ok_ly,
  
        CASE WHEN (capacity_settings_id IS NULL AND :cap_is_null = 1)
                  OR (capacity_settings_id = :cap AND :cap_is_null = 0)
             THEN 1 ELSE 0 END AS ok_cap,
  
        CASE WHEN scale_dep_by_capacity = :scale THEN 1 ELSE 0 END AS ok_scale,
        CASE WHEN CAST(COALESCE(floating_budget, :fb) AS INTEGER) = CAST(:fb AS INTEGER) THEN 1 ELSE 0 END AS ok_fb,
  
        capacity_settings_id,
        scale_dep_by_capacity,
        COALESCE(floating_budget, :fb) AS fb
      FROM param_sets
      WHERE result_id >= 1
        AND scenario_id = :scn
        AND earliest_year = :ey
        AND latest_year   = :ly
      ORDER BY result_id ASC
      LIMIT 200
    ";
  
    $diag = $pdo->prepare($diagSql);
    $diag->bindValue(':scn', $scenario_id, PDO::PARAM_INT);
    $diag->bindValue(':ey',  $earliest_year, PDO::PARAM_INT);
    $diag->bindValue(':ly',  $latest_year, PDO::PARAM_INT);
    $diag->bindValue(':pth3i', $pth3i, PDO::PARAM_INT);
    $diag->bindValue(':wd3i',  $wd3i,  PDO::PARAM_INT);
    $diag->bindValue(':wg3i',  $wg3i,  PDO::PARAM_INT);
    $diag->bindValue(':we3i',  $we3i,  PDO::PARAM_INT);
    $diag->bindValue(':scale', $scale_by_cap, PDO::PARAM_INT);
    $diag->bindValue(':fb',    $floating_budget, PDO::PARAM_INT);
    $diag->bindValue(':cap_is_null', $capacity_settings_id === null ? 1 : 0, PDO::PARAM_INT);
    if ($capacity_settings_id !== null) {
      $diag->bindValue(':cap', $capacity_settings_id, PDO::PARAM_INT);
    } else {
      // still bind something to avoid "parameter missing" in literal printing if you log it
      $diag->bindValue(':cap', 0, PDO::PARAM_INT);
    }
    $diag->execute();
    $cands = $diag->fetchAll();
  
    $debug['phase'] = 'no-match';
    $debug['diagnostic_sql'] = $diagSql;
    $debug['diagnostic_params'] = [
      ':scn'=>$scenario_id, ':ey'=>$earliest_year, ':ly'=>$latest_year,
      ':pth3i'=>$pth3i, ':wd3i'=>$wd3i, ':wg3i'=>$wg3i, ':we3i'=>$we3i,
      ':scale'=>$scale_by_cap, ':fb'=>$floating_budget,
      ':cap'=>$capacity_settings_id ?? 0, ':cap_is_null'=>($capacity_settings_id===null?1:0),
    ];
    $debug['candidates'] = $cands;
  
    // nearest by integer deltas (for curiosity)
    $nearest = [];
    foreach ($cands as $r) {
      $nearest[] = [
        'result_id' => $r['result_id'],
        'sum_delta' => abs($r['wd3i_db'] - $wd3i) + abs($r['wg3i_db'] - $wg3i) + abs($r['we3i_db'] - $we3i) + abs($r['pth3i_db'] - $pth3i),
        'd_wd' => abs($r['wd3i_db'] - $wd3i),
        'd_wg' => abs($r['wg3i_db'] - $wg3i),
        'd_we' => abs($r['we3i_db'] - $we3i),
        'd_pth'=> abs($r['pth3i_db'] - $pth3i),
      ];
    }
    usort($nearest, fn($a,$b)=> ($a['sum_delta'] <=> $b['sum_delta']));
    $debug['nearest_by_weights_top5'] = array_slice($nearest, 0, 5);
  }

  // ---------- INSERT new param_set (no match) ----------
  $maxRow    = $pdo->query("SELECT COALESCE(MAX(result_id),0) AS maxid FROM param_sets")->fetch();
  $result_id = ((int)$maxRow['maxid']) + 1;

  $ins = $pdo->prepare("
    INSERT INTO param_sets
      (result_id, is_calculated, date_calculated, date_last_used,
       scenario_id, earliest_year, latest_year, phaseout_thresh,
       w_dom_energy, w_gov_revenue, w_employment,
       capacity_settings_id, scale_dep_by_capacity, floating_budget)
    VALUES
      (:rid, 0, NULL, strftime('%s','now'),
       :scn, :ey, :ly, :pth_store,
       :wd_store, :wg_store, :we_store,
       :cap, :scale, :fb)
  ");
  $ins->execute([
    ':rid'       => $result_id,
    ':scn'       => $scenario_id,
    ':ey'        => $earliest_year,
    ':ly'        => $latest_year,
    ':pth_store' => $phaseout_thr_f,   // fraction (e.g., 0.9)
    ':wd_store'  => $w_dom_sent,       // store weights as sent (percent)
    ':wg_store'  => $w_gov_sent,
    ':we_store'  => $w_emp_sent,
    ':cap'       => $capacity_settings_id, // NULL for OFF
    ':scale'     => $scale_by_cap,
    ':fb'        => $floating_budget,
  ]);

  $pdo->commit();

  $resp = [
    'status'          => 'pending',
    'result_id'       => $result_id,
    'existing'        => false,
    'cap_settings_id' => $capacity_settings_id,
  ];
  if ($debugOn) {
    $debug['phase'] = 'inserted';
    $resp['debug'] = $debug;
  }

  echo json_encode($resp, JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
  error_log('[param_submit_simple] '.$e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}
