var TWEEN = require('tween.js');
var eventify = require('ngraph.events');
var createAutoPilot = require('./autoPilot');
var createHitTest = require('./hitTest');
var createUserInputController = require('./userInput');
var createNodeView = require('./nodeView');
var createLinkView = require('./linkView');

module.exports = sceneView;

function sceneView(graphModel) {
  var view = init3dView();
  var nodeView = createNodeView(view.getScene());
  var linkView = createLinkView(view.getScene());
  var shouldShowLinks = linkView.linksVisible();
  var autoPilot = createAutoPilot(view.getCamera());

  var api = eventify({
    search: search,
    subgraph: subgraph,
    focus: focus,
    focusOnPackage: focusOnPackage
  });

  var hitTest = createHitTest(view.domElement);
  hitTest.on('nodeover', handleNodeHover);
  hitTest.on('nodeclick', handleNodeClick);
  hitTest.on('nodedblclick', handleNodeDblClick);

  var userInputController = createUserInputController(view.getCamera(), view.domElement);
  userInputController.on('steeringModeChanged', toggleSteeringIndicator);
  userInputController.on('toggleLinks', function() {
    shouldShowLinks = linkView.toggleLinks();
  });

  view.onrender(hitTest.update);
  view.onrender(userInputController.update);

  graphModel.on('nodesReady', nodeView.initialize);
  graphModel.on('linksReady', function(graphModel) {
    linkView.initialize(graphModel);
    adjustNodeSize(graphModel);
  });

  return api;

  function focusOnPackage(packageName) {
    var pos = graphModel.getPackagePosition(packageName);
    if (!pos) return; // we are missing data
    hitTest.postpone();
    autoPilot.flyTo(pos, function done() {
      showPreview(packageName);
    });
  }

  function adjustNodeSize(model) {
    var graph = model.getGraph();
    graph.forEachNode(function(node) {
      var outCount = 0;
      node.links.forEach(function(link) {
        if (link.toId === node.id) outCount += 1;
      });
      var size = (100 / 7402) * outCount + 15;
      nodeView.setNodeUI(node.id, 0xffffff, size);
    });
    nodeView.refresh();
  }

  function search(pattern) {
    graphModel.filter(pattern);
    nodeView.initialize(graphModel);
    // we always hide links when graph is filtered. Restore links rendering
    // settings only when graph is not filtered
    if (pattern && shouldShowLinks) {
      linkView.linksVisible(false);
    } else if (!pattern) {
      linkView.linksVisible(shouldShowLinks);
    }
    adjustNodeSize(graphModel);
    hitTest.reset();
  }

  function subgraph(name) {
    nodeView.initialize(graphModel);
    nodeView.refresh();

    linkView.initialize(graphModel);
    var sphere = nodeView.getBoundingSphere();
    var camera = view.getCamera();

    var offset = sphere.radius / Math.tan(Math.PI / 180.0 * camera.fov * 0.5);
    autoPilot.flyTo(sphere.center, offset);
    hitTest.reset();
  }

  function focus() {
    if (view.domElement) {
      // always focus on next event cycle, to prevent race conditions
      setTimeout(function() {
        view.domElement.focus();
      }, 0);
    }
  }

  function toggleSteeringIndicator(isOn) {
    var steering = document.querySelector('.steering');
    steering.style.display = isOn ? 'none' : 'block';
  }

  function showPreview(packageName) {
    // todo: This violates SRP. Should this be in a separate module?
    if (packageName === undefined) return; // no need to toggle full preview

    var dependencies = 0;
    var dependents = 0;
    var node = graphModel.getNodeByName(packageName);

    node.links.forEach(calculateDependents);

    api.fire('preview', {
      name: packageName,
      dependencies: dependencies,
      dependents: dependents
    });

    function calculateDependents(link) {
      if (link.fromId === node.id) {
        dependencies += 1;
      } else {
        dependents += 1;
      }
    }
  }

  function handleNodeHover(e) {
    api.fire('show-node-tooltip', {
      name: getPackageNameFromIndex(e.nodeIndex),
      mouse: e
    });
  }

  function handleNodeClick(e) {
    showPreview(getPackageNameFromIndex(e.nodeIndex));
  }

  function handleNodeDblClick(e) {
    focusOnPackage(getPackageNameFromIndex(e.nodeIndex));
  }

  function getPackageNameFromIndex(idx) {
    if (idx !== undefined) {
      var node = graphModel.getGraph().getNode(idx);
      return node && node.data.label;
    }
  }
}

function init3dView() {
  var scene = new THREE.Scene();
  scene.sortObjects = false;

  var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 20000);
  camera.position.x = 0;
  camera.position.y = 0;
  camera.position.z = 0;
  camera.lookAt(new THREE.Vector3(-9000, -9000, 9000));
  window.camera = camera;

  var renderCallbacks = [];

  var renderer = new THREE.WebGLRenderer({
    antialias: false
  });
  renderer.setClearColor(0x000000, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  window.addEventListener('resize', onWindowResize, false);

  animate();

  return {
    onrender: onrender,
    getScene: getScene,
    getCamera: getCamera,
    domElement: renderer.domElement
  };

  function onrender(callback) {
    renderCallbacks.push(callback);
  }

  function getScene() {
    return scene;
  }

  function getCamera() {
    return camera;
  }

  function animate(time) {
    requestAnimationFrame(animate);

    renderer.render(scene, camera);
    for (var i = 0; i < renderCallbacks.length; ++i) {
      renderCallbacks[i](scene, camera);
    }
    TWEEN.update(time);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
