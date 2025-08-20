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

  $rid = isset($_GET['result_id']) ? (int)$_GET['result_id'] : 0;
  if ($rid <= 0) { http_response_code(400); echo json_encode(['error'=>'Missing result_id']); exit; }

  $row = $pdo->prepare("SELECT is_calculated, date_calculated, date_last_used FROM param_sets WHERE result_id=? LIMIT 1");
  $row->execute([$rid]);
  $ss = $row->fetch();
  if (!$ss) { http_response_code(404); echo json_encode(['error'=>'Unknown result_id']); exit; }

  echo json_encode([
    'result_id'       => $rid,
    'status'          => ((int)$ss['is_calculated'] === 1 ? 'ready' : 'pending'),
    'is_calculated'   => (int)$ss['is_calculated'],
    'date_calculated' => $ss['date_calculated'],
    'date_last_used'  => $ss['date_last_used'],
  ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error'=>$e->getMessage()]);
}
