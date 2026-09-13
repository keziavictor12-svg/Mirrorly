(function () {
  let THREE;
  let GLTFLoader;
  let FaceLandmarker;
  let ImageSegmenter;
  let FilesetResolver;
  let landmarker;
  let hairSegmenter;
  let hairSegmenterPromise;
  let visionFileset;
  let renderer;
  let scene;
  let camera;
  let hairMesh;
  let hairFrontMesh;
  let hairModelMount;
  let faceOccluder;
  let activeHairModel;
  let activeModelProfile;
  let activeModelStyleId = "";
  let modelLoader;
  let hairTexture;
  let hairFrontTexture;
  let outputCanvas;
  let videoElement;
  let initializationPromise;
  let enabled = false;
  let lastVideoTime = -1;
  let lastDetectionAt = 0;
  let lastFaceAt = 0;
  let styleProfile = null;
  let landmarkerMode = "VIDEO";
  let measuringImage = false;
  let modelLoadVersion = 0;
  let trackedHairVisible = false;
  const modelCache = new Map();

  const current = {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    roll: 0,
    yaw: 0,
    pitch: 0,
    modelScale: 1,
    faceWidth: 1,
    faceHeight: 1,
    faceCenterX: 0,
    faceCenterY: 0,
    foreheadY: 0,
    opacity: 0
  };

  const target = { ...current };

  async function createLandmarker(vision) {
    const options = {
      baseOptions: {
        modelAssetPath: "./models/face_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
      outputFacialTransformationMatrixes: true
    };

    try {
      return await FaceLandmarker.createFromOptions(vision, options);
    } catch {
      options.baseOptions.delegate = "CPU";
      return FaceLandmarker.createFromOptions(vision, options);
    }
  }

  async function createHairSegmenter(delegate) {
    return ImageSegmenter.createFromOptions(visionFileset, {
      baseOptions: {
        modelAssetPath: './models/hair_segmenter.tflite',
        delegate
      },
      runningMode: 'IMAGE',
      outputCategoryMask: false,
      outputConfidenceMasks: true
    });
  }

  async function getHairSegmenter() {
    if (!hairSegmenterPromise) {
      hairSegmenterPromise = (async () => {
        try {
          return await createHairSegmenter('GPU');
        } catch {
          return createHairSegmenter('CPU');
        }
      })();
    }
    try {
      hairSegmenter = await hairSegmenterPromise;
      return hairSegmenter;
    } catch (error) {
      hairSegmenterPromise = null;
      throw error;
    }
  }

  async function initialize(canvas, video) {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      const [visionModule, threeModule, gltfModule] = await Promise.all([
        import("./vendor/mediapipe/vision_bundle.mjs"),
        import("./vendor/three/three.module.min.js"),
        import("./vendor/three/addons/loaders/GLTFLoader.js")
      ]);
      FaceLandmarker = visionModule.FaceLandmarker;
      ImageSegmenter = visionModule.ImageSegmenter;
      FilesetResolver = visionModule.FilesetResolver;
      THREE = threeModule;
      GLTFLoader = gltfModule.GLTFLoader;
      outputCanvas = canvas;
      videoElement = video;

      const vision = await FilesetResolver.forVisionTasks("./vendor/mediapipe/wasm");
      landmarker = await createLandmarker(vision);
      visionFileset = vision;

      renderer = new THREE.WebGLRenderer({
        canvas: outputCanvas,
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance"
      });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = false;

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 4000);
      camera.position.z = 2000;
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.HemisphereLight(0xfff2df, 0x172526, 1.65));
      const keyLight = new THREE.DirectionalLight(0xffe3bd, 2.2);
      keyLight.position.set(-500, -700, 1200);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0x9bcac8, 1.1);
      rimLight.position.set(700, -250, 500);
      scene.add(rimLight);

      hairMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          opacity: 1,
          toneMapped: true
        })
      );
      hairMesh.visible = false;
      hairMesh.rotation.order = "XYZ";
      scene.add(hairMesh);

      hairFrontMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          depthTest: true,
          side: THREE.DoubleSide,
          opacity: 1,
          toneMapped: true
        })
      );
      hairFrontMesh.visible = false;
      hairFrontMesh.renderOrder = 3;
      hairFrontMesh.rotation.order = 'XYZ';
      scene.add(hairFrontMesh);

      hairModelMount = new THREE.Group();
      hairModelMount.visible = false;
      hairModelMount.rotation.order = "XYZ";
      scene.add(hairModelMount);

      faceOccluder = new THREE.Mesh(
        new THREE.CircleGeometry(0.5, 64),
        new THREE.MeshBasicMaterial({
          colorWrite: false,
          depthWrite: true,
          depthTest: true,
          side: THREE.DoubleSide
        })
      );
      faceOccluder.visible = false;
      faceOccluder.renderOrder = -100;
      scene.add(faceOccluder);

      modelLoader = new GLTFLoader();
      return true;
    })();
    return initializationPromise;
  }

  function announceModelStatus(status, detail = {}) {
    window.dispatchEvent(new CustomEvent("mirrorly-ar-model", {
      detail: { status, styleId: styleProfile?.id || "", ...detail }
    }));
  }

  function clearActiveModel() {
    if (!activeHairModel || !hairModelMount) return;
    hairModelMount.remove(activeHairModel);
    activeHairModel.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material?.dispose();
    });
    activeHairModel = null;
    activeModelProfile = null;
    activeModelStyleId = "";
    hairModelMount.visible = false;
    faceOccluder.visible = false;
  }

  function forEachModelMaterial(callback) {
    if (!activeHairModel) return;
    activeHairModel.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material) callback(material, object);
    });
  }

  function applyModelColor(colorValue) {
    if (!activeHairModel || !colorValue) return;
    const tint = new THREE.Color(colorValue);
    const lift = tint.getHSL({ h: 0, s: 0, l: 0 }).l < 0.16 ? 0.16 : 0.08;
    tint.lerp(new THREE.Color(0xffffff), lift);
    forEachModelMaterial((material) => {
      if (material.color) material.color.copy(tint);
      material.metalness = 0;
      material.roughness = Math.max(0.58, material.roughness ?? 0.72);
      material.side = THREE.DoubleSide;
      material.alphaTest = activeModelProfile?.alphaTest ?? 0.06;
      material.alphaToCoverage = true;
      material.transparent = true;
      material.depthTest = true;
      material.depthWrite = true;
      material.userData.mirrorlyBaseOpacity ??= material.opacity;
      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
        material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      }
      material.needsUpdate = true;
    });
  }

  function prepareModel(template, profile) {
    const root = template.clone(true);
    root.name = `mirrorly-${profile.id || "hair"}`;
    root.position.set(
      -(profile.anchor?.[0] || 0),
      -(profile.anchor?.[1] || 0),
      -(profile.anchor?.[2] || 0)
    );
    root.rotation.set(
      profile.rotation?.[0] || 0,
      profile.rotation?.[1] || 0,
      profile.rotation?.[2] || 0
    );
    root.traverse((object) => {
      if (!object.isMesh) return;
      if (!object.geometry.attributes.normal) object.geometry.computeVertexNormals();
      if (Array.isArray(object.material)) {
        object.material = object.material.map((material) => material.clone());
      } else {
        object.material = object.material.clone();
      }
      object.frustumCulled = false;
      object.renderOrder = 1;
    });
    return root;
  }

  async function loadHairModel(profile, colorValue, version) {
    announceModelStatus("loading", { model: profile.src });
    try {
      let promise = modelCache.get(profile.src);
      if (!promise) {
        promise = modelLoader.loadAsync(profile.src);
        modelCache.set(profile.src, promise);
      }
      const gltf = await promise;
      if (version !== modelLoadVersion || styleProfile?.model3d?.src !== profile.src) return;
      clearActiveModel();
      activeModelProfile = profile;
      activeModelStyleId = styleProfile.id;
      activeHairModel = prepareModel(gltf.scene, profile);
      hairModelMount.add(activeHairModel);
      applyModelColor(colorValue);
      announceModelStatus("ready", { model: profile.src, license: profile.license || "" });
    } catch (error) {
      if (version !== modelLoadVersion) return;
      clearActiveModel();
      console.error("Mirrorly 3D hairstyle failed to load", error);
      announceModelStatus("fallback", { model: profile.src, message: error.message });
    }
  }

  function setHair(sourceCanvas, style, color, foregroundCanvas = null) {
    if (!renderer || !sourceCanvas || !style) return;
    hairTexture?.dispose();
    hairTexture = new THREE.CanvasTexture(sourceCanvas);
    hairTexture.colorSpace = THREE.SRGBColorSpace;
    hairTexture.flipY = false;
    hairTexture.needsUpdate = true;
    hairMesh.material.map = hairTexture;
    hairMesh.material.needsUpdate = true;
    hairFrontTexture?.dispose();
    hairFrontTexture = null;
    hairFrontMesh.material.map = null;
    if (foregroundCanvas) {
      hairFrontTexture = new THREE.CanvasTexture(foregroundCanvas);
      hairFrontTexture.colorSpace = THREE.SRGBColorSpace;
      hairFrontTexture.flipY = false;
      hairFrontTexture.needsUpdate = true;
      hairFrontMesh.material.map = hairFrontTexture;
    }
    hairFrontMesh.material.needsUpdate = true;
    styleProfile = {
      id: style.id,
      faceOpeningRatio: style.faceOpeningRatio,
      faceOpeningHeightRatio: style.faceOpeningHeightRatio || 0,
      faceCenterYRatio: style.faceCenterYRatio,
      faceOffsetXRatio: style.faceOffsetXRatio || 0,
      aspect: sourceCanvas.height / sourceCanvas.width,
      model3d: style.model3d || null,
      layered2d: Boolean(foregroundCanvas)
    };
    trackedHairVisible = false;
    const version = ++modelLoadVersion;
    hairModelMount.visible = false;
    faceOccluder.visible = false;
    if (styleProfile.model3d) {
      loadHairModel(styleProfile.model3d, color?.value || color, version);
    } else {
      clearActiveModel();
      announceModelStatus("png-fallback");
    }
  }

  function setEnabled(value) {
    enabled = value;
    if (!value && hairMesh) {
      hairMesh.visible = false;
      hairFrontMesh.visible = false;
      hairModelMount.visible = false;
      faceOccluder.visible = false;
      trackedHairVisible = false;
    }
    if (!value && renderer) renderer.clear();
  }

  function resize(width, height) {
    if (!renderer || !width || !height) return;
    if (outputCanvas.width !== width || outputCanvas.height !== height) {
      renderer.setSize(width, height, false);
      camera.left = 0;
      camera.right = width;
      camera.top = 0;
      camera.bottom = height;
      camera.updateProjectionMatrix();
    }
  }

  function mirroredPoint(landmark, width, height) {
    return {
      x: (1 - landmark.x) * width,
      y: landmark.y * height,
      z: landmark.z
    };
  }

  function averageMirroredPoint(landmarks, indices, width, height) {
    const total = indices.reduce((sum, index) => {
      const point = mirroredPoint(landmarks[index], width, height);
      sum.x += point.x;
      sum.y += point.y;
      sum.z += point.z;
      return sum;
    }, { x: 0, y: 0, z: 0 });
    return {
      x: total.x / indices.length,
      y: total.y / indices.length,
      z: total.z / indices.length
    };
  }

  function processLandmarks(landmarks, width, height, controls, facialMatrix) {
    const templeA = mirroredPoint(landmarks[234], width, height);
    const templeB = mirroredPoint(landmarks[454], width, height);
    const left = templeA.x < templeB.x ? templeA : templeB;
    const right = templeA.x < templeB.x ? templeB : templeA;
    const sideA = averageMirroredPoint(landmarks, [234, 127, 162], width, height);
    const sideB = averageMirroredPoint(landmarks, [454, 356, 389], width, height);
    const eyeA = mirroredPoint(landmarks[33], width, height);
    const eyeB = mirroredPoint(landmarks[263], width, height);
    const eyeLeft = eyeA.x < eyeB.x ? eyeA : eyeB;
    const eyeRight = eyeA.x < eyeB.x ? eyeB : eyeA;
    const nose = averageMirroredPoint(landmarks, [1, 4, 5], width, height);
    const forehead = mirroredPoint(landmarks[10], width, height);
    const chin = mirroredPoint(landmarks[152], width, height);
    const faceWidth = Math.hypot(right.x - left.x, right.y - left.y) * 1.05;
    const templeCenterX = (left.x + right.x) / 2;
    const sideCenterX = (sideA.x + sideB.x) / 2;
    const eyeCenterX = (eyeLeft.x + eyeRight.x) / 2;
    const faceCenterX = templeCenterX * 0.58 + sideCenterX * 0.27 + eyeCenterX * 0.15;
    const faceCenterY = (forehead.y + chin.y) / 2;
    const scale = controls.scale / 100;
    const drawWidth = faceWidth / styleProfile.faceOpeningRatio * scale;
    const verticalSpan = Math.max(1, chin.y - forehead.y);
    const drawHeight = styleProfile.faceOpeningHeightRatio
      ? verticalSpan / styleProfile.faceOpeningHeightRatio * scale
      : drawWidth * styleProfile.aspect;
    const templeRoll = Math.atan2(right.y - left.y, right.x - left.x);
    const eyeRoll = Math.atan2(eyeRight.y - eyeLeft.y, eyeRight.x - eyeLeft.x);
    const roll = templeRoll * 0.72 + eyeRoll * 0.28;
    let yaw = Math.max(-0.48, Math.min(0.48, (nose.x - faceCenterX) / faceWidth * 1.65));
    let pitch = Math.max(-0.28, Math.min(0.28, ((nose.y - forehead.y) / verticalSpan - 0.53) * 1.3));

    if (facialMatrix?.data?.length === 16) {
      try {
        const matrix = new THREE.Matrix4().fromArray(facialMatrix.data);
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const matrixScale = new THREE.Vector3();
        matrix.decompose(position, quaternion, matrixScale);
        const pose = new THREE.Euler().setFromQuaternion(quaternion, "YXZ");
        yaw = Math.max(-0.72, Math.min(0.72, -pose.y));
        pitch = Math.max(-0.46, Math.min(0.46, pose.x));
      } catch {
        // The landmark-derived pose above remains a stable fallback.
      }
    }

    target.x = faceCenterX
      + (styleProfile.model3d ? 0 : faceWidth * styleProfile.faceOffsetXRatio)
      + controls.x;
    target.y = styleProfile.model3d
      ? faceCenterY + controls.y
      : faceCenterY + drawHeight * (0.5 - styleProfile.faceCenterYRatio) + controls.y;
    target.width = drawWidth;
    target.height = drawHeight;
    target.roll = roll + controls.rotation * Math.PI / 180;
    target.yaw = yaw * controls.depth;
    target.pitch = pitch * controls.depth;
    target.faceWidth = faceWidth;
    target.faceHeight = verticalSpan;
    target.faceCenterX = faceCenterX;
    target.faceCenterY = faceCenterY;
    target.foreheadY = forehead.y;
    target.modelScale = styleProfile.model3d
      ? faceWidth / styleProfile.model3d.canonicalFaceWidth * scale
      : 1;
    target.opacity = controls.opacity;
    lastFaceAt = performance.now();
  }

  function smoothValue(value, next, amount) {
    return value + (next - value) * amount;
  }

  function smoothAngle(value, next, amount) {
    const difference = Math.atan2(Math.sin(next - value), Math.cos(next - value));
    return value + difference * amount;
  }

  function renderTrackedHair(now, controls, showOverlay) {
    const faceIsFresh = now - lastFaceAt < 420;
    const shouldShow = Boolean(enabled && styleProfile && showOverlay && faceIsFresh);
    const useTrue3d = Boolean(
      shouldShow &&
      activeHairModel &&
      activeModelProfile &&
      activeModelStyleId === styleProfile.id
    );
    const useLayered2d = Boolean(shouldShow && !useTrue3d && styleProfile.layered2d && hairFrontTexture);
    hairMesh.visible = shouldShow && !useTrue3d;
    hairFrontMesh.visible = useLayered2d;
    hairModelMount.visible = useTrue3d;
    faceOccluder.visible = useTrue3d || useLayered2d;

    if (shouldShow) {
      if (!trackedHairVisible) {
        for (const key of Object.keys(current)) current[key] = target[key];
        current.opacity = 0;
      }
      const travel = Math.hypot(target.x - current.x, target.y - current.y);
      const relativeTravel = travel / Math.max(1, target.faceWidth);
      const positionAmount = Math.max(0.24, Math.min(0.52, 0.24 + relativeTravel * 0.72));
      const scaleAmount = Math.max(0.22, Math.min(0.44,
        0.22 + Math.abs(target.width - current.width) / Math.max(1, target.width) * 0.7
      ));
      current.x = smoothValue(current.x, target.x, positionAmount);
      current.y = smoothValue(current.y, target.y, positionAmount);
      current.width = smoothValue(current.width, target.width, scaleAmount);
      current.height = smoothValue(current.height, target.height, scaleAmount);
      current.roll = smoothAngle(current.roll, target.roll, 0.26);
      current.yaw = smoothAngle(current.yaw, target.yaw, 0.22);
      current.pitch = smoothAngle(current.pitch, target.pitch, 0.22);
      current.modelScale = smoothValue(current.modelScale, target.modelScale, scaleAmount);
      current.faceWidth = smoothValue(current.faceWidth, target.faceWidth, scaleAmount);
      current.faceHeight = smoothValue(current.faceHeight, target.faceHeight, scaleAmount);
      current.faceCenterX = smoothValue(current.faceCenterX, target.faceCenterX, positionAmount);
      current.faceCenterY = smoothValue(current.faceCenterY, target.faceCenterY, positionAmount);
      current.foreheadY = smoothValue(current.foreheadY, target.foreheadY, positionAmount);
      current.opacity = smoothValue(current.opacity, target.opacity, 0.25);

      if (useTrue3d) {
        const profile = activeModelProfile;
        const modelX = current.x + current.faceWidth * (profile.xOffsetRatio || 0);
        const modelY = current.y + current.faceHeight * (profile.yOffsetRatio || 0);
        hairModelMount.position.set(modelX, modelY, profile.depthOffset || 0);
        hairModelMount.scale.set(current.modelScale, -current.modelScale, current.modelScale);
        hairModelMount.rotation.set(
          -current.pitch * (profile.pitchScale ?? 1),
          current.yaw * (profile.yawScale ?? 1),
          current.roll
        );
        forEachModelMaterial((material) => {
          material.opacity = (material.userData.mirrorlyBaseOpacity ?? 1) * current.opacity;
        });

        faceOccluder.position.set(
          modelX,
          modelY + current.faceHeight * (profile.occluderYOffsetRatio || 0.02),
          current.modelScale * (profile.occluderDepth || 0.72)
        );
        faceOccluder.scale.set(
          current.faceWidth * (profile.occluderWidthRatio || 0.82),
          current.faceHeight * (profile.occluderHeightRatio || 1.05),
          1
        );
        faceOccluder.rotation.set(-current.pitch, current.yaw, current.roll);
      } else {
        hairMesh.position.set(current.x, current.y, 0);
        hairMesh.scale.set(current.width, current.height, 1);
        hairMesh.rotation.set(current.pitch, current.yaw, current.roll);
        hairMesh.material.opacity = current.opacity;
        if (useLayered2d) {
          hairFrontMesh.position.set(current.x, current.y, 2);
          hairFrontMesh.scale.set(current.width, current.height, 1);
          hairFrontMesh.rotation.set(current.pitch, current.yaw, current.roll);
          hairFrontMesh.material.opacity = current.opacity;
          faceOccluder.position.set(
            current.faceCenterX,
            current.faceCenterY + current.faceHeight * 0.025,
            1
          );
          faceOccluder.scale.set(
            current.faceWidth * 0.91,
            current.faceHeight * 1.01,
            1
          );
          faceOccluder.rotation.set(-current.pitch, current.yaw, current.roll);
        }
      }
    }
    trackedHairVisible = shouldShow;
    renderer.render(scene, camera);
  }

  async function segmentHair(imageSource) {
    if (!imageSource?.naturalWidth && !imageSource?.width) {
      throw new Error('A decoded image is required for hair segmentation');
    }
    if (!initializationPromise) {
      throw new Error('Live AR must be initialized before hair segmentation');
    }
    await initializationPromise;
    const segmenter = await getHairSegmenter();
    return new Promise((resolve, reject) => {
      try {
        segmenter.segment(imageSource, (result) => {
          try {
            const masks = result.confidenceMasks || [];
            const labels = segmenter.getLabels?.() || [];
            const labelIndex = labels.findIndex((label) => label.toLowerCase() === 'hair');
            const hairIndex = labelIndex >= 0 ? labelIndex : (masks.length > 1 ? 1 : 0);
            const mask = masks[hairIndex] || masks[masks.length - 1];
            if (!mask) throw new Error('Hair segmentation returned no confidence mask');
            const values = mask.getAsFloat32Array();
            resolve({
              width: mask.width,
              height: mask.height,
              data: Float32Array.from(values)
            });
          } catch (error) {
            reject(error);
          } finally {
            result.close?.();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function update(now, controls, showOverlay) {
    if (!enabled || measuringImage || !renderer || !landmarker || !styleProfile || videoElement.readyState < 2) return;
    const width = videoElement.videoWidth;
    const height = videoElement.videoHeight;
    resize(width, height);

    if (videoElement.currentTime !== lastVideoTime && now - lastDetectionAt >= 66) {
      lastVideoTime = videoElement.currentTime;
      lastDetectionAt = now;
      try {
        const result = landmarker.detectForVideo(videoElement, now);
        const landmarks = result.faceLandmarks?.[0];
        if (landmarks) {
          processLandmarks(
            landmarks,
            width,
            height,
            controls,
            result.facialTransformationMatrixes?.[0]
          );
        }
      } catch {
        // Keep the previous smoothed pose for a brief interval on a dropped frame.
      }
    }
    renderTrackedHair(now, controls, showOverlay);
  }

  async function measureImage(imageSource) {
    if (!landmarker || !imageSource?.width || !imageSource?.height) {
      throw new Error("Face Landmarker is not initialized for capture measurement");
    }
    measuringImage = true;
    try {
      if (landmarkerMode !== "IMAGE") {
        await landmarker.setOptions({ runningMode: "IMAGE" });
        landmarkerMode = "IMAGE";
      }
      const result = landmarker.detect(imageSource);
      const landmarks = result.faceLandmarks?.[0];
      if (!landmarks?.length) return null;

      const width = imageSource.width;
      const height = imageSource.height;
      let minX = 1;
      let minY = 1;
      let maxX = 0;
      let maxY = 0;
      for (const landmark of landmarks) {
        minX = Math.min(minX, landmark.x);
        minY = Math.min(minY, landmark.y);
        maxX = Math.max(maxX, landmark.x);
        maxY = Math.max(maxY, landmark.y);
      }

      const templeA = { x: landmarks[234].x * width, y: landmarks[234].y * height };
      const templeB = { x: landmarks[454].x * width, y: landmarks[454].y * height };
      const leftTemple = templeA.x < templeB.x ? templeA : templeB;
      const rightTemple = templeA.x < templeB.x ? templeB : templeA;
      const forehead = landmarks[10];
      const chin = landmarks[152];

      return {
        x: minX * width,
        y: minY * height,
        width: (maxX - minX) * width,
        height: (maxY - minY) * height,
        centerX: ((leftTemple.x + rightTemple.x) / 2),
        centerY: ((forehead.y + chin.y) / 2) * height,
        roll: Math.atan2(rightTemple.y - leftTemple.y, rightTemple.x - leftTemple.x),
        mirrored: true,
        source: "mediapipe-capture"
      };
    } finally {
      if (landmarkerMode !== "VIDEO") {
        await landmarker.setOptions({ runningMode: "VIDEO" });
        landmarkerMode = "VIDEO";
        lastVideoTime = -1;
      }
      measuringImage = false;
    }
  }

  function getStatus(now = performance.now()) {
    return {
      enabled,
      tracking: now - lastFaceAt < 420,
      styleId: styleProfile?.id || "",
      renderMode: activeHairModel && activeModelStyleId === styleProfile?.id ? "3d" : "png",
      pose: {
        x: current.x,
        y: current.y,
        width: current.width,
        height: current.height,
        roll: current.roll,
        yaw: current.yaw,
        pitch: current.pitch,
        faceWidth: current.faceWidth,
        faceHeight: current.faceHeight,
        faceCenterX: current.faceCenterX,
        faceCenterY: current.faceCenterY,
        foreheadY: current.foreheadY
      }
    };
  }

  function dispose() {
    setEnabled(false);
    clearActiveModel();
    hairTexture?.dispose();
    hairFrontTexture?.dispose();
    hairMesh?.geometry.dispose();
    hairMesh?.material.dispose();
    hairFrontMesh?.geometry.dispose();
    hairFrontMesh?.material.dispose();
    faceOccluder?.geometry.dispose();
    faceOccluder?.material.dispose();
    for (const promise of modelCache.values()) {
      promise.then((gltf) => {
        gltf.scene.traverse((object) => {
          if (!object.isMesh) return;
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            material?.map?.dispose();
            material?.normalMap?.dispose();
            material?.dispose();
          }
        });
      }).catch(() => {});
    }
    modelCache.clear();
    hairSegmenter?.close();
    renderer?.dispose();
    landmarker?.close();
  }

  window.MirrorlyAR = {
    initialize,
    setHair,
    setEnabled,
    update,
    measureImage,
    segmentHair,
    getStatus,
    dispose
  };
})();
