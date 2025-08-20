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
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);

  $fuel      = isset($_GET['fuel']) ? strtolower(trim($_GET['fuel'])) : null; // 'oil'|'coal'|'gas'
  $resultArg = $_GET['result_id'] ?? 'latest';
  $isoList   = trim($_GET['iso3'] ?? ''); // optional: "USA,CAN"

  if (!$fuel || !in_array($fuel, ['oil','coal','gas'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid fuel']);
    exit;
  }

  // Resolve result_id
  if ($resultArg === 'latest') {
    $rid = null;
    $stmt = $pdo->query("
      SELECT result_id
      FROM param_sets
      WHERE is_calculated = 1
      ORDER BY date_last_used DESC, date_calculated DESC
      LIMIT 1
    ");
    $row = $stmt->fetch();
    if ($row && $row['result_id'] !== null) {
      $rid = (int)$row['result_id'];
    } else {
      $stmt2 = $pdo->query("SELECT MAX(result_id) AS rid FROM results_by_fuel");
      $row2  = $stmt2->fetch();
      if ($row2 && $row2['rid'] !== null) $rid = (int)$row2['rid'];
    }
    if ($rid === null) {
      http_response_code(404);
      echo json_encode(['error' => 'No result_id available']);
      exit;
    }
  } else {
    $rid = (int)$resultArg;
  }

  // Build ISO filter if provided
  $params = [':rid' => $rid, ':fuel' => $fuel];
  $isoSQL = '';
  if ($isoList !== '') {
    $isos = array_values(array_filter(array_map(function($c){
      $c = strtoupper(trim($c));
      return preg_match('/^[A-Z]{3}$/', $c) ? $c : null;
    }, explode(',', $isoList))));
    if ($isos) {
      $placeholders = [];
      foreach ($isos as $i => $code) {
        $k = ":iso$i";
        $placeholders[] = $k;
        $params[$k] = $code;
      }
      // NOTE: prefix with rbf. to avoid ambiguity after the JOIN
      $isoSQL = " AND rbf.iso3 IN (" . implode(',', $placeholders) . ") ";
    }
  }

  // Pivot variables -> columns + join country_names for display name
  $sql = "
    SELECT
      rbf.iso3,
      cn.name,
      rbf.fuel,
      SUM(CASE WHEN rbf.variable = 'DepTot'     THEN rbf.value ELSE NULL END) AS DepTot,
      SUM(CASE WHEN rbf.variable = 'Prod_EJ'    THEN rbf.value ELSE NULL END) AS Prod_EJ,
      MAX(CASE WHEN rbf.variable = 'PhaseoutYr' THEN rbf.value ELSE NULL END) AS PhaseoutYr
    FROM results_by_fuel rbf
    LEFT JOIN country_names cn ON cn.iso3 = rbf.iso3
    WHERE rbf.result_id = :rid
      AND rbf.fuel = :fuel
      AND rbf.variable IN ('DepTot','Prod_EJ','PhaseoutYr')
      $isoSQL
    GROUP BY rbf.iso3, rbf.fuel, cn.name
    ORDER BY rbf.iso3
  ";

  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll();

  echo json_encode([
    'result_id' => $rid,
    'fuel'      => $fuel,
    'rows'      => $rows,
  ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}
