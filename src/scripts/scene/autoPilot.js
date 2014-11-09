/**
 * This is an auto pilot which knows how to fly to a given X,Y,Z coordinate
 */

var TWEEN = require('tween.js');

module.exports = autoPilot;

function autoPilot(camera) {
  return {
    flyTo: flyTo
  };

  function flyTo(to, done, cameraOffset) {
    if (typeof done === 'number') {
      cameraOffset = done;
      done = undefined;
    }
    cameraOffset = typeof cameraOffset === 'number' ? cameraOffset : 100;
    // copy camera's current position - we will be animating this value
    var from = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    };

    // Camera needs to stop at given distance from target's center
    var cameraEndPos = intersect(from, to, cameraOffset);

    // Move camera from its current position to target:
    new TWEEN.Tween(from).to(cameraEndPos, 400)
      .easing(TWEEN.Easing.Linear.None)
      .onUpdate(moveCamera)
      .onComplete(function() {
        if (typeof done === 'function') done();
      })
      .start();

    // Also rotate camera while it flies to an object:
    var startRotation = new THREE.Quaternion().copy(camera.quaternion);
    camera.lookAt(new THREE.Vector3(to.x, to.y, to.z));
    var endRotation = new THREE.Quaternion().copy(camera.quaternion);
    camera.quaternion.copy(startRotation); // revert to original rotation

    new TWEEN.Tween({
      x: startRotation.x,
      y: startRotation.y,
      z: startRotation.z,
      w: startRotation.w
    }).to({
      x: endRotation.x,
      y: endRotation.y,
      z: endRotation.z,
      w: endRotation.w
    }, 300).onUpdate(rotateCamera).start();
  }

  function rotateCamera() {
    camera.quaternion.set(this.x, this.y, this.z, this.w);
  }

  function moveCamera(pos) {
    camera.position.x = this.x;
    camera.position.y = this.y;
    camera.position.z = this.z;
  }
}

/**
 * Find intersection point on a sphere surface with radius `r` and center in the `to`
 * with a ray [to, from)
 */
function intersect(from, to, r) {
  // we are using Cartesian to Spherical coordinates transformation to find
  // theta and phi:
  // https://en.wikipedia.org/wiki/Spherical_coordinate_system#Coordinate_system_conversions
  var dx = from.x - to.x;
  var dy = from.y - to.y;
  var dz = from.z - to.z;
  var r1 = Math.sqrt(dx * dx + dy * dy + dz * dz);
  var teta = Math.acos(dz / r1);
  var phi = Math.atan2(dy, dx);

  // And then based on sphere radius we transform back to Cartesian:
  return {
    x: r * Math.sin(teta) * Math.cos(phi) + to.x,
    y: r * Math.sin(teta) * Math.sin(phi) + to.y,
    z: r * Math.cos(teta) + to.z
  };
}
