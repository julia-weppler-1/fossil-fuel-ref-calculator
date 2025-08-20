<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); 

$dbPath = __DIR__ . '/../data/results.sql3';

try {
  if (!file_exists($dbPath)) { http_response_code(500); echo json_encode(['error' => 'Database not found']); exit; }

  $pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  $pdo->exec("PRAGMA busy_timeout=3000");
  $pdo->exec("PRAGMA foreign_keys=ON");

  // --- inputs ---
  $resultArg = $_GET['result_id'] ?? 'latest';  // 'latest' or numeric
  $isoList   = trim($_GET['iso3'] ?? '');       // optional "USA,CAN"

  // --- resolve result_id ---
  if ($resultArg === 'latest') {
    $ridRow = $pdo->query("
      SELECT result_id
      FROM param_sets
      WHERE is_calculated = 1
      ORDER BY date_last_used DESC, result_id DESC
      LIMIT 1
    ")->fetch();

    if ($ridRow && $ridRow['result_id'] !== null) {
      $result_id = (int)$ridRow['result_id'];
    } else {
      $row2 = $pdo->query("SELECT MAX(result_id) AS rid FROM results_by_fuel")->fetch();
      $result_id = (int)($row2['rid'] ?? 0);
    }
  } else {
    $result_id = (int)$resultArg;
  }

  if ($result_id <= 0) { http_response_code(400); echo json_encode(['error' => 'Invalid or missing result_id']); exit; }

  $params = [':rid' => $result_id];
  $isoSQL = '';
  if ($isoList !== '') {
    $isos = array_values(array_filter(array_map(function($c){
      $c = strtoupper(trim($c));
      return preg_match('/^[A-Z]{3}$/', $c) ? $c : null;
    }, explode(',', $isoList))));
    if ($isos) {
      $ph = [];
      foreach ($isos as $i => $code) {
        $k = ":iso$i";
        $ph[] = $k;
        $params[$k] = $code;
      }
      $isoSQL = " AND rbf.iso3 IN (" . implode(',', $ph) . ") ";
    }
  }

  // --- query: pivot variables -> columns, return ALL FUELS for this result_id ---
  $sql = "
    SELECT
      rbf.iso3,
      COALESCE(cn.name, rbf.iso3) AS name,
      rbf.fuel,
      SUM(CASE WHEN rbf.variable = 'DepTot'     THEN rbf.value ELSE NULL END) AS DepTot,
      SUM(CASE WHEN rbf.variable = 'Prod_EJ'    THEN rbf.value ELSE NULL END) AS Prod_EJ,
      MAX(CASE WHEN rbf.variable = 'PhaseoutYr' THEN rbf.value ELSE NULL END) AS PhaseoutYr
    FROM results_by_fuel rbf
    LEFT JOIN country_names cn ON cn.iso3 = rbf.iso3
    WHERE rbf.result_id = :rid
      AND rbf.variable IN ('DepTot','Prod_EJ','PhaseoutYr')
      $isoSQL
    GROUP BY rbf.iso3, rbf.fuel, cn.name
    ORDER BY rbf.fuel, rbf.iso3
  ";

  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll();

  echo json_encode([
    'result_id' => $result_id,
    'rows'      => $rows,   // includes all fuels; each row has iso3,name,fuel,DepTot,Prod_EJ,PhaseoutYr
    'count'     => count($rows),
  ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}
