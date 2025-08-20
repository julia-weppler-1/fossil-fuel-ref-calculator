<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$dbPath = __DIR__ . '/../data/results.sql3';

try {
  if (!file_exists($dbPath)) { http_response_code(500); echo json_encode(['error'=>'Database not found']); exit; }
  $pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);

  $fuel      = isset($_GET['fuel']) ? strtolower(trim($_GET['fuel'])) : null;
  $wantAll   = ($fuel === null || $fuel === '' || $fuel === 'all');
  $resultArg = $_GET['result_id'];
  $isoList   = trim($_GET['iso3'] ?? '');
  if (!$wantAll && !in_array($fuel, ['oil','coal','gas'], true)) {
    http_response_code(400);
    echo json_encode(['error'=>'Missing or invalid fuel']);
    exit;
   }
  // resolve result_id
  $rid = (int)$resultArg;

  $params = [':rid'=>$rid];
  if (!$wantAll) { $params[':fuel'] = $fuel; }
  $isoSQL = '';
  if ($isoList !== '') {
    $isos = array_values(array_filter(array_map(function($c){
      $c = strtoupper(trim($c)); return preg_match('/^[A-Z]{3}$/',$c)?$c:null;
    }, explode(',', $isoList))));
    if ($isos) {
      $ph = []; foreach ($isos as $i=>$code){ $k=":iso$i"; $ph[]=$k; $params[$k]=$code; }
      $isoSQL = " AND t.iso3 IN (".implode(',', $ph).") ";
    }
  }

  // join country_names to get country_name
  $fuelSQL = $wantAll ? '' : ' AND t.fuel = :fuel ';
  $sql = "
    SELECT t.iso3, cn.name, t.fuel, t.year, t.value
    FROM results_timeseries t
    LEFT JOIN country_names cn ON cn.iso3 = t.iso3
    WHERE t.result_id = :rid
        $fuelSQL
    $isoSQL
    ORDER BY t.iso3, t.year
  ";

  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll();

  // group by iso3
  if ($wantAll) {
    $byFuel = [];
        foreach ($rows as $r) {
          $f = $r['fuel'];
          $iso = $r['iso3'];
          if (!isset($byFuel[$f])) $byFuel[$f] = [];
          if (!isset($byFuel[$f][$iso])) {
            $byFuel[$f][$iso] = [
              'iso3'    => $iso,
              'country' => $r['name'] ?: $iso,
              'fuel'    => $f,
              'values'  => []
            ];
          }
          $byFuel[$f][$iso]['values'][] = ['year'=>(int)$r['year'], 'value'=>(float)$r['value']];
        }
        // convert inner maps to arrays
        foreach ($byFuel as $f => $map) { $byFuel[$f] = array_values($map); }
        echo json_encode(['result_id'=>$rid, 'series_by_fuel'=>$byFuel], JSON_UNESCAPED_UNICODE);
      } else {
        // single-fuel (back-compat)
        $by = [];
        foreach ($rows as $r) {
          $iso = $r['iso3'];
          if (!isset($by[$iso])) {
            $by[$iso] = [
              'iso3'    => $iso,
              'country' => $r['name'] ?: $iso,
              'fuel'    => $r['fuel'],
              'values'  => []
            ];
          }
          $by[$iso]['values'][] = ['year'=>(int)$r['year'], 'value'=>(float)$r['value']];
        }
        echo json_encode(['result_id'=>$rid, 'fuel'=>$fuel, 'series'=>array_values($by)], JSON_UNESCAPED_UNICODE);
      }

} catch (Throwable $e) { http_response_code(500); echo json_encode(['error'=>$e->getMessage()]); }
