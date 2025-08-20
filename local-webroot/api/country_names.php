<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$dbPath = __DIR__ . '/../data/results.sql3';
try {
  $pdo = new PDO('sqlite:' . $dbPath);
  $rows = $pdo->query("SELECT iso3, name FROM country_names ORDER BY name")->fetchAll(PDO::FETCH_ASSOC);
  echo json_encode(['countries'=>$rows], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) { http_response_code(500); echo json_encode(['error'=>$e->getMessage()]); }
