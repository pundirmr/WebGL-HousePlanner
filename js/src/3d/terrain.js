var engine3D = window.engine3D || {};

var plots_x = 20;
var plots_y = 20;
var plot_vertices = 2;

var map_left = plots_x /  -2;
var map_top = plots_y / -2;

var terrain3DMouse = {
    x: 0,
    y: 0,
    //state: 0, // 0 - up, 1 - down, 2 - dragging,
    //plot: {x: null, y: null},
    vertex: {x: null, y: null}
};

//VERTEX POINTS
var verticeIndex = function(vertice) {
    return vertice.x + vertice.y * ((plots_x * plot_vertices) + 1);
};

var findLattices = (function() {
    function distance(x, y) {
        return Math.pow(x, 2) + Math.pow(y, 2);
    }
    function generate_n2(radius) {

        var ymax = [0];
        var d = 0;
        var points = [];
        var batch, x, y;
        
        while (d <= radius) {
            yieldable = [];
            
            while (true) {
                batch = [];
                for (x = 0; x < d+1; x++) {
                    y = ymax[x];
                    if (distance(x, y) <= Math.pow(d, 2)) {
                        batch.push({x: x, y: y});
                        ymax[x] += 1;
                    }
                }
                if (batch.length === 0) {
                    break;
                }
                points = points.concat(batch);
            }
            
            d += 1;
            ymax.push(0);
        }
        return points;
    }
    
    return function findLattices(radius, origin) {
        var all_points = [];
        
        var i, point, points = generate_n2(radius);
        for (i = 0; i < points.length; i++) {
            point = points[i];
            
            all_points.push(point);
            if (point.x !== 0) {
                all_points.push({x: -point.x, y: point.y});
            }
            if (point.y !== 0) {
                all_points.push({x: point.x, y: -point.y});
            }
            if (point.x && point.y) {
                all_points.push({x: -point.x, y: -point.y});
            }
        }
        
        for (i = 0; i < all_points.length; i++) {
            all_points[i].x += origin.x;
            all_points[i].y += origin.y;
        }
        
        return all_points;
    };
})();

var landscape = new function() {
    var landscape_tool = null;
    
    this.select = function(tool) {
        landscape_tool = tool;
    };
    this.onmousemove = function() {

        if (!engine3D.controls.enabled) { // The user has clicked and drug their mouse
            
            // Get all of the vertices in a 5-unit radius
            var vertices = findLattices(3 * plot_vertices, terrain3DMouse.vertex);
            
            // Call the landscaping tool to do its job
            this.tools[landscape_tool](3 * plot_vertices, vertices);
            
            // Ensure all of the vertices are within the elevation bounds
            var vertice_index;
            var vertice_data = [];
            //console.log("# of vertices " + vertices.length);

            for (var i = 0; i < vertices.length; i++) {

                vertice_index = verticeIndex(vertices[i]);

                if (engine3D.terrain.displacement.array[vertice_index] > 6) {
                    engine3D.terrain.displacement.array[vertice_index] = 6;
                }
                
                if (engine3D.terrain.displacement.array[vertice_index] < -5) {
                    engine3D.terrain.displacement.array[vertice_index] = -5;
                }
                
                engine3D.terrain.water.displacement.array[vertice_index] = engine3D.terrain.displacement.array[vertice_index];
            }

            engine3D.terrain.water.displacement.needsUpdate = true;
        }
    };
    
    this.tools = {
        hill: function(radius, vertices) {
            
            var i, vertice, vertice_index, distance;
            
            for (i = 0; i < vertices.length; i++) {
                
                vertice = vertices[i];
                
                if (vertice.x < 0 || vertice.y < 0) {
                    continue;
                }
                if (vertice.x >= plots_x * plot_vertices + 1 || vertice.y >= plots_y * plot_vertices + 1) {
                    continue;
                }
                
                vertice_index = verticeIndex(vertice);
                distance = Math.sqrt(Math.pow(terrain3DMouse.vertex.x - vertice.x, 2) + Math.pow(terrain3DMouse.vertex.y - vertice.y, 2));
                
                engine3D.terrain.displacement.array[vertice_index] += Math.pow(radius - distance, 0.5) * 0.03;
                engine3D.terrain.displacement.needsUpdate = true;
            }
        },
        
        valley: function(radius, vertices) {
            
            var i, vertice, vertice_index, distance;
            
            for (i = 0; i < vertices.length; i++) {
                
                vertice = vertices[i];
                
                if (vertice.x < 0 || vertice.y < 0) {
                    continue;
                }
                if (vertice.x >= plots_x * plot_vertices + 1 || vertice.y >= plots_y * plot_vertices + 1) {
                    continue;
                }
                
                vertice_index = verticeIndex(vertice);
                distance = Math.sqrt(Math.pow(terrain3DMouse.vertex.x - vertice.x, 2) + Math.pow(terrain3DMouse.vertex.y - vertice.y, 2));
                
                engine3D.terrain.displacement.array[vertice_index] -= Math.pow(radius - distance, 0.5) * 0.03;
                engine3D.terrain.displacement.needsUpdate = true;
            }
        }
    };
}

function Degrees2Radians(degrees) {
    return degrees * (Math.PI / 180);
}

function scene3DLandscapeGetHeightData(img,scale) //return array with height data from img
{
    if (scale === undefined) 
        scale=1;
  
    var canvas = document.createElement( 'canvas' );
    canvas.width = img.width;
    canvas.height = img.height;
    var context = canvas.getContext( '2d' );
 
    var size = img.width * img.height;
    var data = new Float32Array( size );
 
    context.drawImage(img,0,0);
 
    for ( var i = 0; i < size; i ++ ) {
        data[i] = 0;
    }
 
    var imgd = context.getImageData(0, 0, img.width, img.height);
    var pix = imgd.data;
 
    var j=0;
    for (var i = 0; i<pix.length; i +=4) {
        var all = pix[i]+pix[i+1]+pix[i+2];
        data[j++] = all/(12*scale);
    }
     
    return data;
};

engine3D.initTerrainGround = function()
{
    if(engine3D.terrainMaterial === undefined)
    {
        /*
        //var texture = THREE.ImageUtils.loadTexture('assets/combined.png', null, loaded); // load the heightmap we created as a texture
        var detailTexture = THREE.ImageUtils.loadTexture('objects/Landscape/Textures/G36096.jpg'); //, null, loaded);  // load two other textures we'll use to make the map look more real

        terrainShader = THREE.ShaderTerrain[ "terrain" ];
        uniformsTerrain = THREE.UniformsUtils.clone(terrainShader.uniforms);

        // how to treat abd scale the normal texture
        uniformsTerrain[ "tNormal" ].texture = detailTexture;
        uniformsTerrain[ "uNormalScale" ].value = 0.5;

        // displacement is heightmap (greyscale image)
        //uniformsTerrain[ "tDisplacement" ].value = texture;
        //uniformsTerrain[ "uDisplacementScale" ].value = 15;

        // the following textures can be use to finetune how the map is shown. These are good defaults for simple rendering
        uniformsTerrain[ "tDiffuse1" ].value = detailTexture;
        uniformsTerrain[ "tDetail" ].texture = detailTexture;
        uniformsTerrain[ "enableDiffuse1" ].value = true;
        //uniformsTerrain[ "enableDiffuse2" ].value = true;
        //uniformsTerrain[ "enableSpecular" ].value = true;

        // diffuse is based on the light reflection
        //uniformsTerrain[ "uDiffuseColor" ].value.setHex(0xcccccc);
        //uniformsTerrain[ "uSpecularColor" ].value.setHex(0xff0000);

        // is the base color of the terrain
        //uniformsTerrain[ "uAmbientColor" ].value.setHex(0x0000cc);
     
        // how shiny is the terrain
        //uniformsTerrain[ "uShininess" ].value = 3;

        // handles light reflection
        //uniformsTerrain[ "uRepeatOverlay" ].value.set(3, 3);

        engine3D.terrainMaterial = new THREE.ShaderMaterial({
            uniforms:       uniformsTerrain,
            vertexShader:   terrainShader.vertexShader,
            fragmentShader: terrainShader.fragmentShader,
            lights:         true,
            fog:            false
        });

        var geometryTerrain = new THREE.PlaneGeometry( 40, 40);
        //geometryTerrain.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        geometryTerrain.computeFaceNormals();
        geometryTerrain.computeVertexNormals();
     
        engine3D.terrain = new THREE.Mesh(geometryTerrain, engine3D.terrainMaterial);
        engine3D.terrain.rotation.x = -Math.PI / 2;
        */

        var ground_vertex_data = $.ajax({ url:"shaders/ground.vertex.fx", dataType:'text', async:false}).responseText;
        var ground_fragment_data = $.ajax({ url:"shaders/ground.fragment.fx", dataType:'text', async:false}).responseText;

        engine3D.terrainMaterial = new THREE.ShaderMaterial({
            uniforms: {
                texture_grass: { type: "t", value: engine3D.textureLoader.load('objects/Landscape/Textures/G36096.jpg')},
                texture_bare: { type: "t", value: engine3D.textureLoader.load('objects/Landscape/Textures/F46734.jpg')},
                texture_snow: { type: "t", value: engine3D.textureLoader.load('objects/Landscape/Textures/F46734.jpg')},
                show_ring: { type: 'i', value: true },
                ring_width: { type: 'f', value: 0.15 },
                ring_color: { type: 'v4', value: new THREE.Vector4(1.0, 0.0, 0.0, 1.0) },
                ring_center: { type: 'v3', value: new THREE.Vector3() },
                ring_radius: { type: 'f', value: 1.6 }
            },
            vertexShader: ground_vertex_data,
            fragmentShader: ground_fragment_data,
            //fog: false,
            //lights: true
        });
        var geometry = new THREE.PlaneBufferGeometry( plots_x, plots_y, plots_x * plot_vertices, plots_y * plot_vertices);
        
        var numVertices = geometry.attributes.position.count;
        var displacement = new THREE.Float32BufferAttribute(numVertices * 1, 1);
        geometry.addAttribute( 'displacement', displacement);

        engine3D.terrain = new THREE.Mesh(geometry, engine3D.terrainMaterial);
        engine3D.terrain.displacement = geometry.attributes.displacement;
        engine3D.terrain.displacement.dynamic = true;
        engine3D.terrain.rotation.x = -Math.PI / 2;
        //console.log(geometry.attributes.displacement);
        
        var water_vertex_data = $.ajax({ url:"shaders/water.vertex.fx", dataType:'text', async:false}).responseText;
        var water_fragment_data = $.ajax({ url:"shaders/water.fragment.fx", dataType:'text', async:false}).responseText;
        
        engine3D.terrain.water = new THREE.Mesh(
            geometry,
            new THREE.ShaderMaterial({
                uniforms: {
                    water_level: { type: 'f', value: -1 },
                    time: { type: 'f', value: 0 }
                },
                vertexShader: water_vertex_data,
                fragmentShader: water_fragment_data,
                transparent: true
            })
        );
        engine3D.terrain.water.displacement = geometry.attributes.displacement;
        engine3D.terrain.water.displacement.dynamic = true;
        engine3D.terrain.water.position.z = -1;
        engine3D.terrain.add(engine3D.terrain.water);
    }
};

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

engine3D.initTerrainWater = function ()
{

};