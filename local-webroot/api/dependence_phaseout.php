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

  $resultArg = $_GET['result_id'] ?? '1';
  $fuelParam = strtolower(trim($_GET['fuel'] ?? 'all'));
  $isoList   = trim($_GET['iso3'] ?? '');

  if ($resultArg === 'latest') {
    $rid = null;
    $row = $pdo->query("SELECT result_id FROM param_sets WHERE is_calculated=1 ORDER BY date_last_used DESC, date_calculated DESC LIMIT 1")->fetch();
    if ($row && $row['result_id'] !== null) $rid = (int)$row['result_id'];
    if ($rid === null) { $row = $pdo->query("SELECT MAX(result_id) AS rid FROM results_by_fuel")->fetch(); if ($row && $row['rid'] !== null) $rid = (int)$row['rid']; }
    if ($rid === null) { http_response_code(404); echo json_encode(['error'=>'No result_id available']); exit; }
  } else { $rid = (int)$resultArg; }

  $params = [':rid'=>$rid];
  $fuelSQL = '';
  if (in_array($fuelParam, ['oil','coal','gas'], true)) { $fuelSQL = " AND rbf.fuel = :fuel "; $params[':fuel'] = $fuelParam; }

  $isoSQL_rbf = $isoSQL_res = '';
  if ($isoList !== '') {
    $isos = array_values(array_filter(array_map(function($c){ $c=strtoupper(trim($c)); return preg_match('/^[A-Z]{3}$/',$c)?$c:null; }, explode(',',$isoList))));
    if ($isos) {
      $ph1=[]; $ph2=[];
      foreach ($isos as $i=>$code){ $k=":iso$i"; $ph1[]=$k; $ph2[]=$k; $params[$k]=$code; }
      $isoSQL_rbf = " AND rbf.iso3 IN (".implode(',', $ph1).") ";
      $isoSQL_res = " AND res.iso3 IN (".implode(',', $ph2).") ";
    }
  }

  $sql = "
    WITH rbf AS (
      SELECT
        rbf.iso3,
        cn.name,
        rbf.fuel,
        MAX(CASE WHEN rbf.variable='DepTot'        THEN rbf.value END) AS DepTot,
        MAX(CASE WHEN rbf.variable='Ext_Energy'    THEN rbf.value END) AS Ext_Energy,
        MAX(CASE WHEN rbf.variable='ExtEmp'        THEN rbf.value END) AS ExtEmp,
        MAX(CASE WHEN rbf.variable='ExtRevbyFuel'  THEN rbf.value END) AS ExtRevbyFuel,
        MAX(CASE WHEN rbf.variable='PhaseoutYr'    THEN rbf.value END) AS PhaseoutYr
      FROM results_by_fuel rbf
      LEFT JOIN country_names cn ON cn.iso3 = rbf.iso3
      WHERE rbf.result_id = :rid
        AND rbf.variable IN ('DepTot','Ext_Energy','ExtEmp','ExtRevbyFuel','PhaseoutYr')
        $fuelSQL
        $isoSQL_rbf
      GROUP BY rbf.iso3, cn.name, rbf.fuel
    ),
    sup AS (
      SELECT
        res.iso3,
        MAX(CASE WHEN res.variable='support_pct' THEN res.value END) AS support_pct
      FROM results res
      WHERE res.result_id = :rid
        $isoSQL_res
      GROUP BY res.iso3
    )
    SELECT
      rbf.iso3,
      rbf.name,
      rbf.fuel,
      rbf.DepTot, rbf.Ext_Energy, rbf.ExtEmp, rbf.ExtRevbyFuel, rbf.PhaseoutYr,
      sup.support_pct
    FROM rbf
    LEFT JOIN sup ON sup.iso3 = rbf.iso3
    ORDER BY rbf.iso3, rbf.fuel
  ";

  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll();

  echo json_encode(['result_id'=>$rid, 'rows'=>$rows], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) { http_response_code(500); echo json_encode(['error'=>$e->getMessage()]); }
