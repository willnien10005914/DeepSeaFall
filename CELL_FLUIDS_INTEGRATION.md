# Cell Fluids integration status

The original Cell Fluids extension is not installed. It requires the user's licensed package (or a separately obtained official demo asset). No purchase, license bypass or proprietary asset redistribution was performed.

Official product: https://superhivemarket.com/products/cell-fluids

Cell Fluids authors 2.5D heightfield simulations and exports mesh / flow maps. Its advertised engine shaders target Unity and Unreal; this project renders in Three.js. The adapter accepts an RG velocity flow-map texture:

```js
await window.__deepSeaFall.water.loadFlowMap('/assets/flow/exported-flow.png', {
  source: 'Cell Fluids exported flowmap', flipY: false
});
```

The exported map must encode neutral velocity as RG = 0.5, 0.5, with compatible direction and scale. Validate flipY against a known flow direction before using production exports. A mesh export would require separate loading, scaling and lighting integration.

Until a map is provided, FluidFlow computes a small runtime incompressible velocity field for caustic advection and subtle distortion. This fallback is original project code and is not represented as the Cell Fluids extension. It does not simulate full three-dimensional free-surface ocean fluid.
