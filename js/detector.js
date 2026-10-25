// Motiverkennung im Browser mit MediaPipe (lädt beim ersten Start ~5 MB, danach gecacht).

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';

export async function createDetector() {
  const { FilesetResolver, ObjectDetector } = await import(`${MP}/vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${MP}/wasm`);
  const make = (delegate) =>
    ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'VIDEO',
      scoreThreshold: 0.35,
      maxResults: 5,
    });
  let det;
  try {
    det = await make('GPU');
  } catch {
    det = await make('CPU');
  }
  let last = -1;
  return {
    // Liefert [{x, y, w, h, score, category}] in Video-Pixeln.
    detect(video) {
      let ts = performance.now();
      if (ts <= last) ts = last + 1; // MediaPipe verlangt streng steigende Zeitstempel
      last = ts;
      const res = det.detectForVideo(video, ts);
      return res.detections.map((d) => ({
        x: d.boundingBox.originX,
        y: d.boundingBox.originY,
        w: d.boundingBox.width,
        h: d.boundingBox.height,
        score: d.categories[0]?.score ?? 0,
        category: d.categories[0]?.categoryName ?? '',
      }));
    },
  };
}
