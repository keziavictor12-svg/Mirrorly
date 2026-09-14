(function () {
  let THREE;
  let GLTFLoader;
  let tracking;
  let poseFilter;
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
  let backgroundRepairMesh;
  let hairModelMount;
  let faceOccluder;
  let activeHairModel;
  let activeModelProfile;
  let activeModelStyleId = "";
  let modelLoader;
  let hairTexture;
  let hairFrontTexture;
  let backgroundRepairTexture;
  let outputCanvas;
  let videoElement;
  let initializationPromise;
  let enabled = false;
  let lastVideoTime = -1;
  let lastDetectionAt = 0;
  let lastFaceAt = null;
  let rawFacePose = null;
  let filteredFacePose = null;
  let latestLandmarks = null;
  let inferenceMs = 0;
  let detectionIntervalMs = 1000 / 60;
  let lastInferenceTimestamp = -1;
  let detectionCount = 0;
  let trackingStartedAt = null;
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
    faceCenterX: 0,
    faceCenterY: 0,
    foreheadY: 0,
    opacity: 0
  };

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
        import("./vendor/three/addons/loaders/GLTFLoader.js"),
        import("./tracking.js")
      ]);
      FaceLandmarker = visionModule.FaceLandmarker;
      ImageSegmenter = visionModule.ImageSegmenter;
      FilesetResolver = visionModule.FilesetResolver;
      THREE = threeModule;
      tracking = window.MirrorlyTracking;
      poseFilter = new tracking.PoseFilter();
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
      hairMesh.renderOrder = 1;
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

      backgroundRepairMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false,
          depthTest: true, side: THREE.DoubleSide, toneMapped: false })
      );
      backgroundRepairMesh.visible = false;
      backgroundRepairMesh.renderOrder = 0;
      scene.add(backgroundRepairMesh);

      hairModelMount = new THREE.Group();
      hairModelMount.visible = false;
      hairModelMount.rotation.order = "XYZ";
      scene.add(hairModelMount);

      const faceGeometry = new THREE.BufferGeometry();
      const facePositions = new THREE.BufferAttribute(new Float32Array(468 * 3), 3);
      facePositions.setUsage(THREE.DynamicDrawUsage);
      faceGeometry.setAttribute('position', facePositions);
      const connections = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
      // Eyelid/lip holes belong in a face model, not a depth-only occlusion mask.
      faceGeometry.setIndex(tracking.sealedFaceTriangles(connections));
      faceOccluder = new THREE.Mesh(
        faceGeometry,
        new THREE.MeshBasicMaterial({
          colorWrite: false,
          depthWrite: true,
          depthTest: true,
          side: THREE.DoubleSide
        })
      );
      faceOccluder.visible = false;
      faceOccluder.renderOrder = -100;
      faceOccluder.frustumCulled = false;
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
      modelCache.delete(profile.src);
      announceModelStatus("fallback", { model: profile.src, message: error.message });
    }
  }

  function setHair(sourceCanvas, style, color, foregroundCanvas = null, repairCanvas = null) {
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
    backgroundRepairTexture?.dispose();
    backgroundRepairTexture = null;
    backgroundRepairMesh.material.map = null;
    backgroundRepairMesh.visible = false;
    if (style.aiAttachment && repairCanvas) {
      backgroundRepairTexture = new THREE.CanvasTexture(repairCanvas);
      backgroundRepairTexture.colorSpace = THREE.SRGBColorSpace;
      backgroundRepairTexture.flipY = false;
      backgroundRepairTexture.needsUpdate = true;
      backgroundRepairMesh.material.map = backgroundRepairTexture;
    }
    backgroundRepairMesh.material.needsUpdate = true;
    // Unlike scalp hair, repaired room pixels stay in their capture screen
    // coordinates. Never curve, scale, or rotate the background with the head.
    if (style.aiAttachment) {
      const crop = style.aiAttachment.crop;
      const positions = backgroundRepairMesh.geometry.attributes.position;
      const uv = backgroundRepairMesh.geometry.attributes.uv;
      for (let i = 0; i < positions.count; i++) {
        positions.setXYZ(i, crop.x + uv.getX(i) * crop.width, crop.y + uv.getY(i) * crop.height, -style.aiAttachment.faceWidth);
      }
      positions.needsUpdate = true;
      backgroundRepairMesh.frustumCulled = false;
    }
    for (const mesh of [hairMesh, hairFrontMesh]) {
      mesh.geometry.dispose();
      // A subdivided, landmark-depth strip curves around the forehead/temples.
      // It remains single-view 2.5D, not a generated volumetric hairstyle model.
      mesh.geometry = style.aiAttachment ? new THREE.PlaneGeometry(1, 1, 32, 1) : new THREE.PlaneGeometry(1, 1);
      if (style.aiAttachment) {
        const positions = mesh.geometry.attributes.position;
        const uv = mesh.geometry.attributes.uv;
        for (let i = 0; i < positions.count; i += 1) {
          // flipY=false means v=0 is the top row of the source canvas.
          const p = tracking.capturePointToHead(style.aiAttachment, uv.getX(i), uv.getY(i));
          positions.setXYZ(i, ...p);
        }
        mesh.geometry.userData.headPoints = Array.from(positions.array);
        positions.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
      }
    }
    hairFrontMesh.material.depthTest = !style.aiAttachment;
    hairMesh.material.toneMapped = !style.aiAttachment;
    hairFrontMesh.material.toneMapped = !style.aiAttachment;
    styleProfile = {
      id: style.id,
      faceOpeningRatio: style.faceOpeningRatio,
      faceOpeningHeightRatio: style.faceOpeningHeightRatio || 0,
      faceCenterYRatio: style.faceCenterYRatio,
      faceOffsetXRatio: style.faceOffsetXRatio || 0,
      aspect: sourceCanvas.height / sourceCanvas.width,
      model3d: style.model3d || null,
      layered2d: Boolean(foregroundCanvas),
      aiAttachment: style.aiAttachment || null
    };
    if (filteredFacePose) applyFacePose(filteredFacePose, { x: 0, y: 0, scale: 100, rotation: 0, opacity: 1 });
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
    if (value && !enabled) {
      lastFaceAt = null;
      lastVideoTime = -1;
      lastDetectionAt = -Infinity;
      rawFacePose = null;
      filteredFacePose = null;
      latestLandmarks = null;
      poseFilter?.reset();
      trackingStartedAt = null;
      detectionCount = 0;
    }
    enabled = value;
    if (!value && hairMesh) {
      hairMesh.visible = false;
      hairFrontMesh.visible = false;
      backgroundRepairMesh.visible = false;
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

  function applyFacePose(pose, controls) {
    const scale = (controls.scale ?? 100) / 100;
    const drawWidth = pose.faceWidth / styleProfile.faceOpeningRatio * scale;
    const drawHeight = styleProfile.faceOpeningHeightRatio
      ? pose.faceHeight / styleProfile.faceOpeningHeightRatio * scale
      : drawWidth * styleProfile.aspect;
    const q = new THREE.Quaternion().fromArray(pose.quaternion);
    const euler = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    Object.assign(current, {
      x: styleProfile.model3d ? pose.x + controls.x : pose.faceCenterX + pose.faceWidth * styleProfile.faceOffsetXRatio + controls.x,
      y: styleProfile.model3d ? pose.y + controls.y : pose.faceCenterY + drawHeight * (0.5 - styleProfile.faceCenterYRatio) + controls.y,
      width: drawWidth, height: drawHeight,
      roll: euler.z + controls.rotation * Math.PI / 180,
      yaw: euler.y, pitch: euler.x,
      faceWidth: pose.faceWidth, faceHeight: pose.faceHeight,
      faceCenterX: pose.faceCenterX, faceCenterY: pose.faceCenterY,
      foreheadX: pose.foreheadX, foreheadY: pose.foreheadY,
      fitErrorPx: pose.fitErrorPx,
      modelScale: styleProfile.model3d ? pose.faceWidth / styleProfile.model3d.canonicalFaceWidth * scale : 1,
      opacity: controls.opacity
    });
  }

  function processLandmarks(landmarks, width, height, controls, facialMatrix, now) {
    const pose = tracking.fitFace(landmarks, width, height, facialMatrix);
    if (!pose) return false;
    if (lastFaceAt === null || now - lastFaceAt >= 220) poseFilter.reset();
    rawFacePose = pose;
    filteredFacePose = poseFilter.filter(pose, now);
    latestLandmarks = landmarks;
    applyFacePose(filteredFacePose, controls);
    lastFaceAt = now;
    trackingStartedAt ??= now;
    detectionCount += 1;
    return true;
  }

  function updateFaceOccluder(useTrue3d, profile) {
    if (!latestLandmarks || !rawFacePose || !filteredFacePose) return;
    const positions = faceOccluder.geometry.attributes.position;
    const ratio = filteredFacePose.faceWidth / rawFacePose.faceWidth;
    const rawQ = new THREE.Quaternion().fromArray(rawFacePose.quaternion);
    const q = new THREE.Quaternion().fromArray(filteredFacePose.quaternion);
    const delta = q.multiply(rawQ.invert());
    const point = new THREE.Vector3();
    const depth = useTrue3d ? current.modelScale * (profile.occluderDepth ?? 0.72) : 1;
    for (let i = 0; i < 468; i += 1) {
      const landmark = latestLandmarks[i];
      point.set(
        (1 - landmark.x) * outputCanvas.width - rawFacePose.x,
        landmark.y * outputCanvas.height - rawFacePose.y,
        (rawFacePose.depthOrigin - landmark.z) * outputCanvas.width
      ).multiplyScalar(ratio).applyQuaternion(delta);
      positions.setXYZ(i,
        filteredFacePose.x + point.x,
        filteredFacePose.y + point.y,
        useTrue3d ? depth + point.z : 1 + Math.max(-0.3, Math.min(0.3, point.z / current.faceWidth))
      );
    }
    positions.needsUpdate = true;
    faceOccluder.position.set(0, 0, 0);
    faceOccluder.scale.set(1, 1, 1);
    faceOccluder.rotation.set(0, 0, 0);
  }

  function renderTrackedHair(now, controls, showOverlay) {
    const freshness = tracking.trackingAge(now, lastFaceAt);
    const shouldShow = Boolean(enabled && styleProfile && showOverlay && freshness.tracking && filteredFacePose);
    const useTrue3d = Boolean(shouldShow && activeHairModel && activeModelProfile && activeModelStyleId === styleProfile.id);
    const useLayered2d = Boolean(shouldShow && !useTrue3d && styleProfile.layered2d && hairFrontTexture);
    hairMesh.visible = shouldShow && !useTrue3d;
    hairFrontMesh.visible = useLayered2d;
    backgroundRepairMesh.visible = Boolean(shouldShow && !useTrue3d && styleProfile.aiAttachment && backgroundRepairTexture);
    hairModelMount.visible = useTrue3d;
    faceOccluder.visible = useTrue3d || useLayered2d;

    if (shouldShow) {
      // Filter once per measured frame, not repeatedly per display frame.
      applyFacePose(filteredFacePose, controls);
      const attachment = styleProfile.aiAttachment;
      const opacity = current.opacity * freshness.opacity
        * (attachment ? tracking.aiViewOpacity(filteredFacePose, attachment) : 1);
      if (backgroundRepairMesh.visible) {
        backgroundRepairMesh.material.opacity = opacity * tracking.backgroundRepairOpacity(filteredFacePose, attachment);
        backgroundRepairMesh.visible = backgroundRepairMesh.material.opacity > 0.001;
      }
      if (useTrue3d) {
        const profile = activeModelProfile;
        const q = new THREE.Quaternion().fromArray(filteredFacePose.quaternion);
        const manualRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), controls.rotation * Math.PI / 180);
        q.premultiply(manualRoll);
        // Calibration offsets belong to the head, so they rotate with it.
        const offset = new THREE.Vector3(
          current.faceWidth * (profile.xOffsetRatio ?? 0),
          current.faceHeight * (profile.yOffsetRatio ?? 0),
          profile.depthOffset ?? 0
        ).applyQuaternion(q);
        hairModelMount.position.set(current.x + offset.x, current.y + offset.y, offset.z);
        hairModelMount.scale.set(current.modelScale, -current.modelScale, current.modelScale);
        hairModelMount.quaternion.copy(q);
        forEachModelMaterial((material) => {
          material.opacity = (material.userData.mirrorlyBaseOpacity ?? 1) * opacity;
        });
        updateFaceOccluder(true, profile);
      } else if (attachment) {
        // Capture pixels already contain the original rotation. Undo it once,
        // then rotate around the tracked head origin, not the image crop center.
        for (const [mesh, foreground] of [[hairMesh, false], [hairFrontMesh, true]]) {
          const positions = mesh.geometry.attributes.position;
          const points = mesh.geometry.userData.headPoints;
          for (let i = 0; i < positions.count; i += 1) {
            const p = tracking.projectHeadPoint(points.slice(i * 3, i * 3 + 3), filteredFacePose);
            positions.setXYZ(i, p[0], p[1], p[2] + (foreground ? current.faceWidth : 0));
          }
          positions.needsUpdate = true;
          mesh.position.set(0, 0, 0);
          mesh.scale.set(1, 1, 1);
          mesh.quaternion.identity();
          mesh.material.opacity = opacity;
        }
        updateFaceOccluder(true, { occluderDepth: 0 });
      } else {
        // Planes are honest fallbacks: they cannot expose unseen side/back hair.
        hairMesh.position.set(current.x, current.y, 0);
        hairMesh.scale.set(current.width, current.height, 1);
        hairMesh.rotation.set(current.pitch, current.yaw, current.roll);
        hairMesh.material.opacity = opacity;
        if (useLayered2d) {
          hairFrontMesh.position.set(current.x, current.y, 2);
          hairFrontMesh.scale.set(current.width, current.height, 1);
          hairFrontMesh.rotation.copy(hairMesh.rotation);
          hairFrontMesh.material.opacity = opacity;
          updateFaceOccluder(false, null);
        }
      }
    }
    renderer.render(scene, camera);
  }

  async function prepareHairSegmentation() {
    if (!initializationPromise) return false;
    await initializationPromise;
    await getHairSegmenter();
    return true;
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

    if (videoElement.currentTime !== lastVideoTime && now - lastDetectionAt >= detectionIntervalMs) {
      lastVideoTime = videoElement.currentTime;
      lastDetectionAt = now;
      const inferenceStarted = performance.now();
      try {
        const timestamp = Math.max(now, lastInferenceTimestamp + 0.001);
        lastInferenceTimestamp = timestamp;
        const result = landmarker.detectForVideo(videoElement, timestamp);
        const landmarks = result.faceLandmarks?.[0];
        if (landmarks) {
          processLandmarks(
            landmarks,
            width,
            height,
            controls,
            result.facialTransformationMatrixes?.[0],
            now
          );
        }
      } catch {
        // Keep the previous smoothed pose for a brief interval on a dropped frame.
      } finally {
        const elapsed = performance.now() - inferenceStarted;
        inferenceMs = inferenceMs ? inferenceMs * 0.8 + elapsed * 0.2 : elapsed;
        detectionIntervalMs = Math.max(1000 / 60, inferenceMs * 1.2);
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
      tracking: Boolean(enabled && tracking?.trackingAge(now, lastFaceAt).tracking && filteredFacePose),
      styleId: styleProfile?.id || "",
      renderMode: styleProfile?.aiAttachment ? "ai" : (activeHairModel && activeModelStyleId === styleProfile?.id ? "3d" : "png"),
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
        foreheadX: current.foreheadX,
        foreheadY: current.foreheadY
      },
      metrics: {
        inferenceMs: Math.round(inferenceMs * 10) / 10,
        trackingFps: trackingStartedAt !== null && now > trackingStartedAt
          ? Math.round(Math.max(0, detectionCount - 1) * 1000 / (now - trackingStartedAt)) : 0,
        fitErrorPx: Math.round((current.fitErrorPx ?? 0) * 10) / 10,
        frameAgeMs: lastFaceAt === null ? null : Math.max(0, Math.round(now - lastFaceAt)),
        occluder: 'landmark-depth-mesh'
      }
    };
  }

  function getCapturePose() {
    if (!rawFacePose || !latestLandmarks || !enabled) return null;
    // Numeric geometry only: raw pose matches the captured camera frame.
    const pose = rawFacePose;
    return {
      headX: pose.x, headY: pose.y, faceWidth: pose.faceWidth,
      faceHeight: pose.faceHeight, faceCenterX: pose.faceCenterX,
      faceCenterY: pose.faceCenterY, foreheadX: pose.foreheadX,
      foreheadY: pose.foreheadY, roll: pose.roll, yaw: pose.yaw,
      pitch: pose.pitch, quaternion: pose.quaternion.slice(),
      foreheadDepth: (pose.depthOrigin - latestLandmarks[10].z) * outputCanvas.width,
      depthSamples: [127, 10, 356].map((index) => ({
        x: (1 - latestLandmarks[index].x) * outputCanvas.width,
        depth: (pose.depthOrigin - latestLandmarks[index].z) * outputCanvas.width
      })).sort((a, b) => a.x - b.x)
    };
  }

  function createCaptureFaceMask() {
    if (!rawFacePose || !latestLandmarks || !enabled) return null;
    const ids = tracking.orderedContour(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL);
    if (ids.length < 3) return null;
    // This local canvas is a compositing input, not part of status diagnostics.
    const mask = document.createElement('canvas');
    mask.width = outputCanvas.width; mask.height = outputCanvas.height;
    const ctx = mask.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, rawFacePose.faceWidth * 0.05);
    ctx.filter = 'blur(' + Math.max(0.5, rawFacePose.faceWidth * 0.006) + 'px)';
    ctx.beginPath();
    ids.forEach((id, index) => {
      const p = latestLandmarks[id], x = (1 - p.x) * mask.width, y = p.y * mask.height;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.fill(); ctx.stroke();
    return mask;
  }

  function dispose() {
    setEnabled(false);
    clearActiveModel();
    hairTexture?.dispose();
    hairFrontTexture?.dispose();
    backgroundRepairTexture?.dispose();
    backgroundRepairMesh?.geometry.dispose();
    backgroundRepairMesh?.material.dispose();
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
    prepareHairSegmentation,
    getStatus,
    getCapturePose,
    createCaptureFaceMask,
    dispose
  };
})();
