// 카메라 테스트용 합성 영상(.y4m) 생성 — 실제 사람이 아닌 피부색 타원. 알고리즘 동작 확인용일 뿐 정확도 검증 아님.
// base: 기준 / red: 붉기만 증가 / dark: 조명 70% / pulse: 초록 채널 1.2 Hz 변조(72 bpm 기대) / still: 변조 없음 + 프레임별 미세 잡음
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "out", "videos");
fs.mkdirSync(OUT, { recursive: true });
const W = 240, H = 320, FPS = 30; // 앱의 세로 3:4 프레임과 같은 비율
const SKIN = [200, 150, 130], BG = [40, 40, 48];

function rand(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

function write(name, frames, colorAt) {
  const fd = fs.openSync(path.join(OUT, name + ".y4m"), "w");
  fs.writeSync(fd, `YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`);
  const cx = W / 2, cy = H / 2, rx = W * 0.32, ry = H * 0.3;
  for (let f = 0; f < frames; f++) {
    const [skin, bg] = colorAt(f);
    const Y = Buffer.alloc(W * H), U = Buffer.alloc((W / 2) * (H / 2)), V = Buffer.alloc((W / 2) * (H / 2));
    const rgb = (x, y) => (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 ? skin : bg);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b] = rgb(x, y); Y[y * W + x] = clamp(0.299 * r + 0.587 * g + 0.114 * b); }
    for (let y = 0; y < H / 2; y++) for (let x = 0; x < W / 2; x++) {
      let cb = 0, cr = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const [r, g, b] = rgb(2 * x + dx, 2 * y + dy); cb += 128 - 0.168736 * r - 0.331264 * g + 0.5 * b; cr += 128 + 0.5 * r - 0.418688 * g - 0.081312 * b; }
      U[y * (W / 2) + x] = clamp(cb / 4); V[y * (W / 2) + x] = clamp(cr / 4);
    }
    fs.writeSync(fd, "FRAME\n"); fs.writeSync(fd, Y); fs.writeSync(fd, U); fs.writeSync(fd, V);
  }
  fs.closeSync(fd);
}

write("base", 10, () => [SKIN, BG]);
write("red", 10, () => [[212, 140, 128], BG]);
write("dark", 10, () => [SKIN.map((v) => v * 0.7), BG.map((v) => v * 0.7)]);
// 1.2 Hz × 30 fps → 주기 25프레임. 50프레임 반복이면 끊김 없이 순환
write("pulse", 50, (f) => [[SKIN[0], SKIN[1] + 3 * Math.sin((2 * Math.PI * 1.2 * f) / FPS), SKIN[2]], BG]);
// 변조 없음: 300프레임(10 s) 순환 + 프레임별 전체 밝기 잡음 → 대역 내 뚜렷한 주기 없음
const r = rand(11);
const noise = Array.from({ length: 300 }, () => 1.5 * gauss(r));
write("still", 300, (f) => [SKIN.map((v) => v + noise[f]), BG]);
console.log("videos →", OUT);
