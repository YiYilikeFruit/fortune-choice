// ============================================================
// emboss.js —— 币面图片凹凸浮雕贴图（PL005 方案 A，2026-08-28 实验版）
// 原理：bump mapping 2D 近似——亮度作高度场→相邻像素梯度求法线→
//   固定光源点积得受光 shade→明暗叠加回原图颜色（colorBlend=0 时纯灰阶）
// 分层：embossPixels 纯像素函数（无 DOM，node 可直测）；
//       embossImage DOM 包装（canvas 读图→处理→dataURL，按源+参数缓存）
// 参数（EMBOSS_DEFAULTS）：可调项待用户目检确认后外置 config
// ============================================================

export const EMBOSS_DEFAULTS = Object.freeze({
  size: 512, // 处理分辨率上限（面片显示直径 240px，@2x 足够）
  strength: 0.5, // 凹凸增益（受光侧提亮幅度，(1+strength) 系数）
  ambient: 0.3, // 环境光（背光处最低亮度，0~1）
  slope: 4, // 梯度放大（照片连续色调差分小，放大后明暗才可见）
  lightX: -1, // 光源方位：左上
  lightY: -1,
  lightZ: 0.5, // 光源垂直分量（越小越侧向，明暗变化越明显）
  colorBlend: 1, // 1=明暗叠加回原图颜色；0=纯灰阶
});

const embossCache = new Map();

// 纯像素浮雕：RGBA 数组 + 宽高 + 配置 → 输出 RGBA
// 逻辑：灰度=0.299r+0.587g+0.114b；法线=(梯度*slope,梯度*slope,1)；光源(含 lightZ)归一化
//   后点积，clamp 0~1 得 shade；factor=ambient+shade*(1-ambient)*(1+strength)；
//   colorBlend 时原色乘 factor（保色相），否则灰阶=128+(shade-0.5)*255*(1+strength)
export function embossPixels(src, w, h, cfg = {}) {
  const c = { ...EMBOSS_DEFAULTS, ...cfg };
  const n = w * h;
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    gray[i] =
      0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
  }
  const L = Math.hypot(c.lightX, c.lightY, c.lightZ);
  const nlx = c.lightX / L;
  const nly = c.lightY / L;
  const nlz = c.lightZ / L;
  const gain = 1 + c.strength;
  const out = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < h; y++) {
    const rowUp = Math.max(0, y - 1) * w;
    const rowDn = Math.min(h - 1, y + 1) * w;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const gx =
        ((gray[i + (x + 1 < w ? 1 : 0)] - gray[i - (x > 0 ? 1 : 0)]) / 255) *
        c.slope;
      const gy = ((gray[rowDn + x] - gray[rowUp + x]) / 255) * c.slope;
      let dot = nlx * gx + nly * gy + nlz;
      const shade = dot < 0 ? 0 : dot > 1 ? 1 : dot;
      const factor = c.ambient + shade * (1 - c.ambient) * gain;
      const base = i * 4;
      if (c.colorBlend) {
        out[base] = Math.min(255, src[base] * factor);
        out[base + 1] = Math.min(255, src[base + 1] * factor);
        out[base + 2] = Math.min(255, src[base + 2] * factor);
        out[base + 3] = src[base + 3];
      } else {
        const g = Math.max(0, Math.min(255, 128 + (shade - 0.5) * 255 * gain));
        out[base] = g;
        out[base + 1] = g;
        out[base + 2] = g;
        out[base + 3] = src[base + 3];
      }
    }
  }
  return out;
}

// 图片浮雕 DOM 包装：缩放→drawImage→embossPixels→dataURL，同源同参缓存
// 输入：img 已加载的图片元素、cfg 覆盖配置；输出：dataURL 字符串
export function embossImage(img, cfg = {}) {
  const key = `${img.currentSrc || img.src}::${JSON.stringify(cfg)}`;
  if (embossCache.has(key)) return embossCache.get(key);
  const c = { ...EMBOSS_DEFAULTS, ...cfg };
  const scale = Math.min(
    1,
    c.size / Math.max(img.naturalWidth, img.naturalHeight, 1),
  );
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  id.data.set(embossPixels(id.data, w, h, c));
  ctx.putImageData(id, 0, 0);
  const url = cv.toDataURL("image/png");
  embossCache.set(key, url);
  return url;
}

// 清空浮雕缓存（内存回收/参数变更时调用）
export function clearEmbossCache() {
  embossCache.clear();
}

// ============================================================
// 模块逻辑说明
// embossPixels(src,w,h,cfg)：输入 RGBA→灰度高度场（0.299/0.587/0.114 权重）→
//   横向梯度 gx=(右-左)/255、纵向 gy=(下-上)/255（边界钳制），再乘 slope 放大
//   （照片连续色调差分小，放大后明暗变化才可见）→
//   光源(lightX,lightY,lightZ)归一化后与法线(梯度,梯度,1)点积，clamp 0~1 得 shade；
//   lightZ 越小越侧向（nlz 恒定项占比下降），明暗变化越明显。
//   factor=ambient+shade*(1-ambient)*(1+strength)：shade=0 时最低亮度=ambient，
//   shade=1 时提亮到 (1+strength)*(1-ambient)+ambient，明暗对称可控。
//   colorBlend=1 原色乘 factor（色相不变、仅明暗），=0 时灰阶以 128 为中心拉伸。
//   设计理由：一次性预渲染（结果缓存），无每帧重算；梯度除 255 归一化保证参数无量纲；
//   ambient 直接控背光下限，strength 控凹凸幅度，slope 控照片灵敏度，参数语义独立。
// embossImage(img,cfg)：按 源图+参数 缓存；缩放到 size 上限→drawImage→getImageData→
//   embossPixels→putImageData→toDataURL。异常由调用方（ui._setFaceMark）降级保留原图。
// embossCache/clearEmbossCache：同图同参只算一次；主题切换/参数变更后清缓存。
// 关联：js/ui.js _setFaceMark 图片分派调用；默认参数待目检后外置 config。
// ============================================================
