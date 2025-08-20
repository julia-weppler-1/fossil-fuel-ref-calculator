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

  // ---------- inputs ----------
  $fuelRaw = strtolower(trim((string)($_GET['fuel'] ?? 'all')));
  $valid = ['oil','coal','gas','all'];
  if (!in_array($fuelRaw, $valid, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid fuel', 'got' => $fuelRaw, 'allowed' => $valid]);
    exit;
  }
  $fuels = ($fuelRaw === 'all') ? ['oil','coal','gas'] : [$fuelRaw];

  // result_id
  $resultArg = $_GET['result_id'] ?? 'latest';
  if ($resultArg === 'latest') {
    $rid = null;
    // prefer “last used” computed result
    $row = $pdo->query("
      SELECT result_id
      FROM param_sets
      WHERE is_calculated = 1 AND result_id >= 1
      ORDER BY date_last_used DESC, date_calculated DESC
      LIMIT 1
    ")->fetch();
    if ($row && $row['result_id'] !== null) $rid = (int)$row['result_id'];

    // fallback to largest result_id present in results_by_fuel
    if ($rid === null) {
      $row = $pdo->query("SELECT MAX(result_id) AS rid FROM results_by_fuel WHERE result_id >= 1")->fetch();
      if ($row && $row['rid'] !== null) $rid = (int)$row['rid'];
    }
    if ($rid === null) {
      http_response_code(404);
      echo json_encode(['error' => 'No result_id available']);
      exit;
    }
  } else {
    $rid = (int)$resultArg;
    if ($rid < 1) {
      http_response_code(400);
      echo json_encode(['error' => 'result_id must be >= 1']);
      exit;
    }
  }

  // ---------- dynamic CTE for fuels ----------
  // WITH fuels(fuel) AS (SELECT ? UNION ALL SELECT ? ...)
  $fuelCteParts = [];
  $fuelParams = [];
  foreach ($fuels as $f) { $fuelCteParts[] = 'SELECT ?'; $fuelParams[] = $f; }
  $fuelsCTE = 'WITH fuels(fuel) AS (' . implode(' UNION ALL ', $fuelCteParts) . ')';

  // ---------- query ----------
  $sql = "
    $fuelsCTE,

    caps AS (
      SELECT
        iso3,
        MAX(CASE WHEN variable='capacity_pcap' THEN value END) AS capacity_pcap,
        MAX(CASE WHEN variable='support_pct'   THEN value END) AS support_pct
      FROM results
      WHERE result_id = :rid
      GROUP BY iso3
    ),

    phase AS (
      SELECT
        rbf.iso3,
        LOWER(TRIM(rbf.fuel)) AS fuel,
        MAX(CASE WHEN rbf.variable='PhaseoutYr' THEN rbf.value END) AS PhaseoutYr
      FROM results_by_fuel rbf
      WHERE rbf.result_id = :rid
        AND LOWER(TRIM(rbf.fuel)) IN (SELECT fuel FROM fuels)
      GROUP BY rbf.iso3, LOWER(TRIM(rbf.fuel))
    ),

    supporters AS (
      SELECT iso3
      FROM results
      WHERE result_id = :rid
        AND variable = 'support_pct'
        AND value IS NOT NULL
        AND value > 0
        AND iso3 <> 'WORLD'
    ),

    -- supporters per fuel (only where they are NOT an extractor of that fuel)
    supporters_per_fuel AS (
      SELECT s.iso3, f.fuel
      FROM supporters s
      CROSS JOIN fuels f
      WHERE NOT EXISTS (
        SELECT 1 FROM phase p
        WHERE p.iso3 = s.iso3 AND p.fuel = f.fuel
      )
    ),

    combined AS (
      -- A) Extractors (have PhaseoutYr for the fuel)
      SELECT
        p.iso3                                      AS iso3,
        cn.name                                     AS country,
        p.fuel                                      AS fuel,
        p.PhaseoutYr                                AS PhaseoutYr,
        c.capacity_pcap                             AS capacity_pcap,
        c.support_pct                               AS support_pct,
        0                                           AS is_supporter
      FROM phase p
      LEFT JOIN caps c            ON c.iso3 = p.iso3
      LEFT JOIN country_names cn  ON cn.iso3 = p.iso3
      WHERE p.iso3 <> 'WORLD'

      UNION ALL

      -- B) Non-extracting supporters for each fuel they don't extract
      SELECT
        spf.iso3                                    AS iso3,
        cn2.name                                    AS country,
        spf.fuel                                    AS fuel,
        NULL                                        AS PhaseoutYr,
        c2.capacity_pcap                            AS capacity_pcap,
        c2.support_pct                              AS support_pct,
        1                                           AS is_supporter
      FROM supporters_per_fuel spf
      LEFT JOIN caps c2           ON c2.iso3 = spf.iso3
      LEFT JOIN country_names cn2 ON cn2.iso3 = spf.iso3
      WHERE spf.iso3 <> 'WORLD'
    )

    SELECT iso3, country, fuel, PhaseoutYr, capacity_pcap, support_pct, is_supporter
    FROM combined
    ORDER BY iso3, fuel
  ";

  $stmt = $pdo->prepare($sql);

  // bind fuels for CTE, then :rid (appears 3x)
  $bindIndex = 1;
  foreach ($fuelParams as $fp) { $stmt->bindValue($bindIndex++, $fp); }
  $stmt->bindValue(':rid', $rid, PDO::PARAM_INT);

  $stmt->execute();
  $rows = $stmt->fetchAll();

  echo json_encode([
    'result_id' => $rid,
    'fuel'      => $fuelRaw,    // 'all' or specific
    'rows'      => $rows
  ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}
