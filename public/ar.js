(function () {
  let THREE;
  let GLTFLoader;
  let FaceLandmarker;
  let FilesetResolver;
  let landmarker;
  let renderer;
  let scene;
  let camera;
  let hairMesh;
  let hairModelMount;
  let faceOccluder;
  let activeHairModel;
  let activeModelProfile;
  let activeModelStyleId = "";
  let modelLoader;
  let hairTexture;
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

  async function initialize(canvas, video) {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      const [visionModule, threeModule, gltfModule] = await Promise.all([
        import("./vendor/mediapipe/vision_bundle.mjs"),
        import("./vendor/three/three.module.min.js"),
        import("./vendor/three/addons/loaders/GLTFLoader.js")
      ]);
      FaceLandmarker = visionModule.FaceLandmarker;
      FilesetResolver = visionModule.FilesetResolver;
      THREE = threeModule;
      GLTFLoader = gltfModule.GLTFLoader;
      outputCanvas = canvas;
      videoElement = video;

      const vision = await FilesetResolver.forVisionTasks("./vendor/mediapipe/wasm");
      landmarker = await createLandmarker(vision);

      renderer = new THREE.WebGLRenderer({
        canvas: outputCanvas,
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
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

  function setHair(sourceCanvas, style, color) {
    if (!renderer || !sourceCanvas || !style) return;
    hairTexture?.dispose();
    hairTexture = new THREE.CanvasTexture(sourceCanvas);
    hairTexture.colorSpace = THREE.SRGBColorSpace;
    hairTexture.flipY = false;
    hairTexture.needsUpdate = true;
    hairMesh.material.map = hairTexture;
    hairMesh.material.needsUpdate = true;
    styleProfile = {
      id: style.id,
      faceOpeningRatio: style.faceOpeningRatio,
      faceOpeningHeightRatio: style.faceOpeningHeightRatio || 0,
      faceCenterYRatio: style.faceCenterYRatio,
      faceOffsetXRatio: style.faceOffsetXRatio || 0,
      aspect: sourceCanvas.height / sourceCanvas.width,
      model3d: style.model3d || null
    };
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
      hairModelMount.visible = false;
      faceOccluder.visible = false;
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

  function processLandmarks(landmarks, width, height, controls, facialMatrix) {
    const templeA = mirroredPoint(landmarks[234], width, height);
    const templeB = mirroredPoint(landmarks[454], width, height);
    const left = templeA.x < templeB.x ? templeA : templeB;
    const right = templeA.x < templeB.x ? templeB : templeA;
    const nose = mirroredPoint(landmarks[1], width, height);
    const forehead = mirroredPoint(landmarks[10], width, height);
    const chin = mirroredPoint(landmarks[152], width, height);
    const faceWidth = Math.hypot(right.x - left.x, right.y - left.y) * 1.05;
    const faceCenterX = (left.x + right.x) / 2;
    const faceCenterY = (forehead.y + chin.y) / 2;
    const scale = controls.scale / 100;
    const drawWidth = faceWidth / styleProfile.faceOpeningRatio * scale;
    const verticalSpan = Math.max(1, chin.y - forehead.y);
    const drawHeight = styleProfile.faceOpeningHeightRatio
      ? verticalSpan / styleProfile.faceOpeningHeightRatio * scale
      : drawWidth * styleProfile.aspect;
    const roll = Math.atan2(right.y - left.y, right.x - left.x);
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

    target.x = faceCenterX + faceWidth * styleProfile.faceOffsetXRatio + controls.x;
    target.y = faceCenterY + drawHeight * (0.5 - styleProfile.faceCenterYRatio) + controls.y;
    target.width = drawWidth;
    target.height = drawHeight;
    target.roll = roll + controls.rotation * Math.PI / 180;
    target.yaw = yaw * controls.depth;
    target.pitch = pitch * controls.depth;
    target.faceWidth = faceWidth;
    target.faceHeight = verticalSpan;
    target.modelScale = styleProfile.model3d
      ? faceWidth / styleProfile.model3d.canonicalFaceWidth * scale
      : 1;
    target.opacity = controls.opacity;
    lastFaceAt = performance.now();
  }

  function smoothValue(value, next, amount) {
    return value + (next - value) * amount;
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
    hairMesh.visible = shouldShow && !useTrue3d;
    hairModelMount.visible = useTrue3d;
    faceOccluder.visible = useTrue3d;

    if (shouldShow) {
      current.x = smoothValue(current.x, target.x, 0.28);
      current.y = smoothValue(current.y, target.y, 0.28);
      current.width = smoothValue(current.width, target.width, 0.24);
      current.height = smoothValue(current.height, target.height, 0.24);
      current.roll = smoothValue(current.roll, target.roll, 0.24);
      current.yaw = smoothValue(current.yaw, target.yaw, 0.20);
      current.pitch = smoothValue(current.pitch, target.pitch, 0.20);
      current.modelScale = smoothValue(current.modelScale, target.modelScale, 0.24);
      current.faceWidth = smoothValue(current.faceWidth, target.faceWidth, 0.24);
      current.faceHeight = smoothValue(current.faceHeight, target.faceHeight, 0.24);
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
      }
    }
    renderer.render(scene, camera);
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
        pitch: current.pitch
      }
    };
  }

  function dispose() {
    setEnabled(false);
    clearActiveModel();
    hairTexture?.dispose();
    hairMesh?.geometry.dispose();
    hairMesh?.material.dispose();
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
    renderer?.dispose();
    landmarker?.close();
  }

  window.MirrorlyAR = { initialize, setHair, setEnabled, update, measureImage, getStatus, dispose };
})();
