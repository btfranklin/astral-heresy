const vsSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fsSource = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_player;
  uniform float u_pulse;
  uniform vec2 u_lane;
  uniform float u_laneActive;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      value += noise(p) * amp;
      p *= 2.0;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 p = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
    float t = u_time * 0.08;

    float n = fbm(p * 2.6 + vec2(t, -t));
    float neb = fbm(p * 3.8 - vec2(t * 0.8, t * 0.5));
    float swirl = sin((p.x + p.y + n * 1.5) * 4.5 + t * 2.4);

    vec3 base = mix(vec3(0.02, 0.02, 0.07), vec3(0.1, 0.2, 0.45), n);
    base += vec3(0.4, 0.12, 0.32) * smoothstep(0.15, 0.8, neb);
    base += vec3(0.1, 0.35, 0.3) * smoothstep(-0.2, 0.7, swirl);

    float starSeed = hash(floor(uv * u_resolution.xy * 0.65) + 7.0);
    float star = step(0.9965, starSeed) * (0.6 + 0.4 * hash(uv * 90.0));
    base += star * vec3(1.0, 0.95, 0.85);

    vec2 playerUv = u_player / u_resolution;
    float d = distance(uv, playerUv);
    base += vec3(0.2, 0.8, 0.7) * smoothstep(0.45, 0.0, d) * 0.35;

    base += vec3(0.8, 0.2, 0.5) * u_pulse * 0.25;

    if (u_laneActive > 0.5) {
      float laneMin = u_lane.x / u_resolution.x;
      float laneMax = u_lane.y / u_resolution.x;
      float laneMask =
        smoothstep(laneMin - 0.015, laneMin + 0.025, uv.x) *
        (1.0 - smoothstep(laneMax - 0.025, laneMax + 0.015, uv.x));
      float bayMask = 1.0 - laneMask;
      float panelLeft = 0.5 + 0.5 * sin(uv.y * 30.0 + u_time * 0.55 + 0.8);
      float panelRight = 0.5 + 0.5 * sin(uv.y * 26.0 - u_time * 0.45 + 2.1);
      vec3 bayTint = mix(vec3(0.02, 0.05, 0.08), vec3(0.12, 0.17, 0.13), panelLeft * panelRight);
      float innerGlow =
        smoothstep(0.06, 0.0, abs(uv.x - laneMin)) +
        smoothstep(0.06, 0.0, abs(uv.x - laneMax));
      base = mix(base, bayTint, bayMask * 0.72);
      base *= 1.0 - bayMask * 0.14;
      base += vec3(0.24, 0.34, 0.32) * innerGlow * 0.26;
    }

    float vignette = smoothstep(1.1, 0.3, length(p));
    base *= vignette;

    gl_FragColor = vec4(base, 1.0);
  }
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vsSourceCode, fsSourceCode) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSourceCode);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSourceCode);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function createBackgroundRenderer(gl) {
  const program = createProgram(gl, vsSource, fsSource);
  const attribs = {
    a_position: gl.getAttribLocation(program, "a_position"),
  };
  const uniforms = {
    u_resolution: gl.getUniformLocation(program, "u_resolution"),
    u_time: gl.getUniformLocation(program, "u_time"),
    u_player: gl.getUniformLocation(program, "u_player"),
    u_pulse: gl.getUniformLocation(program, "u_pulse"),
    u_lane: gl.getUniformLocation(program, "u_lane"),
    u_laneActive: gl.getUniformLocation(program, "u_laneActive"),
  };

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  function resize(width, height, dpr) {
    gl.viewport(0, 0, Math.floor(width * dpr), Math.floor(height * dpr));
  }

  function render(state, player) {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(attribs.a_position);
    gl.vertexAttribPointer(attribs.a_position, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(uniforms.u_resolution, state.view.width * state.view.dpr, state.view.height * state.view.dpr);
    gl.uniform1f(uniforms.u_time, state.time);
    gl.uniform2f(uniforms.u_player, player.x * state.view.dpr, player.y * state.view.dpr);
    gl.uniform1f(uniforms.u_pulse, state.pulse);
    gl.uniform2f(
      uniforms.u_lane,
      state.playfield.minX * state.view.dpr,
      state.playfield.maxX * state.view.dpr
    );
    gl.uniform1f(uniforms.u_laneActive, state.playfield.active ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  return { resize, render };
}
