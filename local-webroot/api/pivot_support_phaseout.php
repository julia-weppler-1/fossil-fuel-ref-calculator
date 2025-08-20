<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // dev only

$dbPath = __DIR__ . '/../data/results.sql3';

try {
  if (!file_exists($dbPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Database not found']);
    exit;
  }

  $pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);

  $resultArg = $_GET['result_id'] ?? 'latest';
  $fuelParam = trim($_GET['fuel'] ?? 'all');
  $isoList   = trim($_GET['iso3'] ?? '');

  // --- result_id parsing: support single, latest, or comma list ---
  $rids = [];
  if (strpos($resultArg, ',') !== false) {
    foreach (explode(',', $resultArg) as $p) {
      $p = trim($p);
      if ($p === '') continue;
      if (!ctype_digit($p)) {
        http_response_code(400);
        echo json_encode(['error' => "Invalid result_id in list: '$p'"]);
        exit;
      }
      $rids[] = (int)$p;
    }
    if (!$rids) {
      http_response_code(400);
      echo json_encode(['error' => 'Empty result_id list']);
      exit;
    }
  } else if ($resultArg === 'latest') {
    $rid = null;
    $row = $pdo->query("
      SELECT result_id
      FROM param_sets
      WHERE is_calculated = 1
      ORDER BY date_last_used DESC, date_calculated DESC
      LIMIT 1
    ")->fetch();
    if ($row && $row['result_id'] !== null) $rid = (int)$row['result_id'];
    if ($rid === null) {
      $row = $pdo->query("SELECT MAX(result_id) AS rid FROM results_by_fuel")->fetch();
      if ($row && $row['rid'] !== null) $rid = (int)$row['rid'];
    }
    if ($rid === null) { http_response_code(404); echo json_encode(['error'=>'No result_id available']); exit; }
    $rids = [$rid];
  } else {
    if (!ctype_digit($resultArg)) {
      http_response_code(400);
      echo json_encode(['error' => 'Invalid result_id']);
      exit;
    }
    $rids = [(int)$resultArg];
  }

  // Build placeholders for the list of result_ids
  $params = [];
  $ridHolders = [];
  foreach ($rids as $i => $ridVal) {
    $k = ":rid$i";
    $ridHolders[] = $k;
    $params[$k] = $ridVal;
  }
  $ridListSQL = implode(',', $ridHolders);

  // fuel filter (optional)
  $fuelSQL = '';
  if ($fuelParam !== '' && strtolower($fuelParam) !== 'all') {
    $fuels = array_values(array_filter(array_map(function($s){
      $s = strtolower(trim($s));
      return in_array($s, ['oil','coal','gas'], true) ? $s : null;
    }, explode(',', $fuelParam))));
    if ($fuels) {
      $holders = [];
      foreach ($fuels as $i => $f) { $k=":fuel$i"; $holders[]=$k; $params[$k]=$f; }
      $fuelSQL = " AND LOWER(rbf.fuel) IN (" . implode(',', $holders) . ") ";
    }
  }

  // iso filter (optional)
  $isoSQL = '';
  if ($isoList !== '') {
    $isos = array_values(array_filter(array_map(function($c){
      $c = strtoupper(trim($c));
      return preg_match('/^[A-Z]{3}$/', $c) ? $c : null;
    }, explode(',', $isoList))));
    if ($isos) {
      $holders = [];
      foreach ($isos as $i => $code) { $k=":iso$i"; $holders[]=$k; $params[$k]=$code; }
      $isoSQL = " AND rbf.iso3 IN (" . implode(',', $holders) . ") ";
    }
  }

  // --- query across multiple result_ids; keep result_id in the output ---
  $sql = "
    WITH pivot AS (
      SELECT
        rbf.result_id,
        rbf.iso3,
        LOWER(rbf.fuel) AS fuel,
        SUM(CASE WHEN rbf.variable='Ext_Energy'    THEN rbf.value END) AS Ext_Energy,
        SUM(CASE WHEN rbf.variable='ExtEmp'        THEN rbf.value END) AS ExtEmp,
        SUM(CASE WHEN rbf.variable='ExtRevbyFuel'  THEN rbf.value END) AS ExtRevbyFuel,
        MAX(CASE WHEN rbf.variable='PhaseoutYr'    THEN rbf.value END) AS PhaseoutYr
      FROM results_by_fuel rbf
      WHERE rbf.result_id IN ($ridListSQL)
        AND rbf.variable IN ('Ext_Energy','ExtEmp','ExtRevbyFuel','PhaseoutYr')
        $fuelSQL
        $isoSQL
      GROUP BY rbf.result_id, rbf.iso3, fuel
    ),
    support AS (
      SELECT result_id, iso3, MAX(CASE WHEN variable='support_pct' THEN value END) AS support_pct
      FROM results
      WHERE result_id IN ($ridListSQL)
      GROUP BY result_id, iso3
    )
    SELECT
      p.result_id,
      p.iso3,
      cn.name AS country,
      p.fuel,
      p.Ext_Energy,
      p.ExtEmp,
      p.ExtRevbyFuel,
      p.PhaseoutYr AS phaseout,
      s.support_pct
    FROM pivot p
    LEFT JOIN support s ON s.result_id = p.result_id AND s.iso3 = p.iso3
    LEFT JOIN country_names cn ON cn.iso3 = p.iso3
    ORDER BY p.result_id, p.iso3, p.fuel
  ";

  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll();

  echo json_encode(['result_ids'=>$rids, 'rows'=>$rows], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}
