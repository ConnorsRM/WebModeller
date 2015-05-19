
/*
<!-- 
Ryan Connors
1344722
rmconnor@ucsc.edu
P3 : Runtime transformations with picking
-->
 */

var MAX_VERT_COUNT;

//GLSL Shaders
var vShader;
var fShader;

//Buffers
var vBuffer;
var nBuffer;
var vPosition;
var vNormal;

var currentVBuffInd;
var currentNBuffInd;

//contexts
var gl;
var canvas;

//tables for picking
var arraySize;
var pixelData;
var colorData;

//Global Table for Meshes
var meshTable;

//global color value for mesh color id assignment
var gblColorID;

//Program State Variables
var isReal;
var currentPick;
var mousePos;
var initialMousePos;
var initialPixel;
var resolvingEvent;
var zDown;
var sDown;
var qDown;
var wDown;
var eDown;



//Shader Support Functions

 /*
  *Shader support
  *
  */
function initShaders(gl, vShaderName, fShaderName) {
    function getShader(gl, shaderName, type) {
    	//createShader instantiates the wrap used during glsl compilation.
        var shader = gl.createShader(type),
            shaderScript = shaderName;
        if (!shaderScript) {
            alert("Could not find shader source: "+shaderName);
        }
        //gl.shaderSource links a shader source to the already created shader wrapper.
        gl.shaderSource(shader, shaderScript);
        //compile shader will actually compile the provided string glsl block
        gl.compileShader(shader);

		//getShaderParameter in this case is checking the ensure the compilation
		//of the shaders went off without a hitch
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert(gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }
    
    var vertexShader = getShader(gl, vShaderName, gl.VERTEX_SHADER),
        fragmentShader = getShader(gl, fShaderName, gl.FRAGMENT_SHADER),
        //createProgram generates a program object that will store the compiled shader information
        program = gl.createProgram();

	//attach shader attached the compiled gl shader code to its program object container
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    //link program links all of the components including the compiled shader code together.
    gl.linkProgram(program);

	//getProgramParameter in this case is checking to ensure the linking went off properly
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
        return null;
    }

    
    return program;
};

/*
 * initBuffers serves to initialize the buffers, but can also be used to flush them in a pinch
 */

function initBuffers(vertCount) {
	vBuffer = gl.createBuffer();
	cBuffer = gl.createBuffer();
	
	//init vertex buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, 12 * vertCount, gl.STATIC_DRAW);
	
	vPosition = gl.getAttribLocation(program, "vPosition");
	gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(vPosition);
	
	//normal buffer and attrib then enable them so they actually contribute
	nBuffer= gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, 12 * vertCount, gl.STATIC_DRAW);
	
	vNormal   = gl.getAttribLocation(program, "vNormal");
	gl.vertexAttribPointer(vNormal, 3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(vNormal);
	
	
	
}

/*
	Transformation support functions
 */
 function makeScale(sX, sY, sZ) {
 
	return [ sX, 	0,		0,		0.0,
			 0.0,	sY,		0, 		0.0,
			 0.0,	0.0,	sZ ,	0.0,
			 0.0,	0.0,	0.0,	1.0];
 }
 
 function makeRotation3DX(angle) {
	
	var cos = Math.cos(angle);
	var sin = Math.sin(angle);
	
	return [
		1.0,	0.0,	0.0,	0.0,
		0.0,	cos,	sin,	0.0,
		0.0,	-1*sin,	cos,	0.0,
		0.0,	0.0,	0.0,	1.0
	];
}

function makeRotation3DY(angle) {
	var cos = Math.cos(angle);
	var sin = Math.sin(angle);
	
	return [
		cos,	0.0,	-1*sin,		0.0,
		0.0,	1.0,	0.0,		0.0,
		sin,	0.0,	cos,		0.0,
		0.0,	0.0,	0.0,		1.0
	];
}

function makeRotation3DZ(angle) {
	var cos = Math.cos(angle);
	var sin = Math.sin(angle);
	return [
		cos,	sin,	0.0,	0.0,
		-1*sin, cos,	0.0,	0.0,
		0.0,	0.0,	1.0,	0.0,
		0.0,	0.0,	0.0,	1.0
	];
}

function makeTranslation3D(deltaX, deltaY, deltaZ) {
	return [
		1.0, 	0.0, 	0.0,	0.0,
		0.0, 	1.0, 	0.0,	0.0,
		0.0,	0.0,	1.0,	0.0,
		deltaX,	deltaY,	deltaZ, 1.0
	];
}

function makeSphere(radius) {
	//current lat/long bands hard coded but could be supplied as argument
	var vertexList = [[]];
	var polyList = [];
	
	var latBands = 30;
	var longBands = 30;
	
	//generate verts
	for(var thisLat = 0; thisLat <= latBands; ++thisLat ) {
		var alpha = thisLat * (Math.PI / latBands);
		var sAlpha = Math.sin(alpha);
		var cAlpha = Math.cos(alpha);
		
		for(var thisLong = 0; thisLong <= longBands; ++thisLong) {
			var beta = thisLong * (2*Math.PI /longBands);
			var sBeta = Math.sin(beta);
			var cBeta = Math.cos(beta);
			
			//generate vertex
			var temp = [];
			temp.push(radius * (cBeta * sAlpha));
			temp.push(radius * cAlpha);
			temp.push(radius * (sBeta * sAlpha));
			vertexList.push( temp );	
			
		}
	}
	
	//stitch them together into polys
	for(var thisLat = 0; thisLat < latBands; ++thisLat) {
		for(var thisLong = 0; thisLong < longBands; ++thisLong) {
			
			var topLeft = (thisLat * (longBands + 1)) + thisLong + 1;
			var btmLeft = topLeft + longBands + 2;
			
			var thisPoly = ["sphere", topLeft, btmLeft, btmLeft+1, topLeft+1];
			polyList.push(thisPoly);
		}
	}
	
	return [vertexList, polyList];
	
}

//update framebuffer data
function  updatePixelData() {
	arraySize = canvas.width * canvas.height * 32;
	pixelData = new Uint8Array(arraySize);
	gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
	colorData = new Uint32Array(pixelData.buffer); 
}


									//Tri-Poly-Mesh Object Group
/*
 * Triangle Class : represents a triangle 
 */

function Triangle(vtxList, mesh) {
	
	if (vtxList.length != 3) {
		console.log("Error : Triangle : Constructor called with invalid list");
		return undefined;
	}
	
	this.vertList = [];
	
	this.parentMesh = mesh;
	
	for (var index = 0; index < vtxList.length; ++index) {
		this.vertList.push(vtxList[index]);
	}

	this.calculateNormal = function() {
		var normalVec = new Vector();
		
		var vecA =  this.parentMesh.vertTable[this.vertList[1]].sub(this.parentMesh.vertTable[this.vertList[0]]);
		var vecB =  this.parentMesh.vertTable[this.vertList[2]].sub(this.parentMesh.vertTable[this.vertList[0]]);
		  
		normalVec = vecA.crossProduct(vecB);
		return normalVec;
	}
	
}


/*
 * Polygon class : represents a polygon in three dimensional space.
 */
function Polygon(vtxList, mesh) {

	this.vertList = [];
	
	for(var index = 0; index < vtxList.length; ++index){
		this.vertList.push(vtxList[index]);
	}
	
	this.vertCount = function() {return this.vertList.length;};	
	
	this.addVert = function(key) {
		vertList.push(key);
	}
	
	this.parentMesh = mesh;
	
	//Walk through each  vertex and use them to create tris, ignore the techicalities of what tesselation actually entails
	this.tesselate = function() {
	
		var triList = []
		for (var index = 2; index < this.vertList.length; ++index) {
		
			var thisTri = new Triangle( [ this.vertList[0],
										  this.vertList[index-1],
										  this.vertList[index]    ], this.parentMesh );
										  
			triList.push(thisTri);
			
			//obtain vertex normals
			var normalVec = thisTri.calculateNormal();
			
			for (var triInd = 0; triInd < (thisTri.vertList).length; ++triInd) {
				this.parentMesh.vertTable[thisTri.vertList[triInd]].addNormal(normalVec);
			}
			
	}
		
		return triList;
	}
}


/*
 *  Mesh Class   : repress a mesh level object in three dimensional space
 * 
 *  	fields : colorID - table color for picking
 * 				 materialColor - what to fill the shark polys as
 * 				 polyTable - the table storing polygon objects
 * 				 triTable  - same thing with tris
 * 				 vertTable - stores all the distinct vertices so they can
 * 						     be refenced by key in poly and tri objects
 * 
 * 				startBufInde - the vBuffer/nBuffer index this object begins at
 * 
 * 				endBufInd    - depreciated, the index after the last vertex in buffer
 * 
 * 				vertCount    - number of vertices in the object
 * 
 * 				scaleMat     - the scaling operation matrix associated with this object
 * 
 * 				rotMat       - ''   rotational '''
 * 					x, y, z  - per axis
 * 
 * 				transmat     - ''   translational ''
 * 
 * 				startState   - the stored transformation matrix associated to this objects position prior to manipultation
 * 
 * 				min/max coordiantes - the max and min coordinates in the vertex set used for geometric centricity calculations
 * 
 * 	Functions
 * 				geometricCenter - return a vector to the center of the object
 * 
 * 				
 * 				parseData      - give an array of verts and an array of polys, generates the vertTable and ties together polys
 * 
 * 				pushBuffer     - places object data in buffer
 * 				
 * 				tesselate      - should probably be named triangulate, turns polys into tris and populates tri table
 * 
 * 				scale          - manipulator for scalemat
 * 
 * 				scale percentage - reduces scaleMat by some percentage
 * 
 * 				rotateX/RotateXRelative - rotates object on axis by specified ammount in angle varible, angle should be in radians
 * 
 * 				translate/translate relative - manipulates transmat
 * 
 * 				setStartState - reset startState field to current transformation matrix
 * 
 * 				render - draws object t0 canvas
 * 
 * 
 * 
 */
function Mesh(colorID, begInd) {
	this.colorID = colorID.copy();
	this.materialColor = new Vector4D(0.3, 0.3, 0.3, 1.0);
	
	this.polyTable = [];
	this.triTable = [];
	this.vertTable = [];
	this.vertTable.push([]);

	this.startBufInd = begInd;
	this.endBufInd;
	this.vertCount;
	
		
	this.scaleMat = new Matrix4D(); 
	this.scaleMat.populateFromArray([ 1.0, 0.0, 0.0, 0.0,
									  0.0, 1.0, 0.0, 0.0,
									  0.0, 0.0, 1.0, 0.0,
									  0.0, 0.0, 0.0, 1.0]);
	
	this.rotMatX = new Matrix4D();
	this.rotMatX.populateFromArray([ 1.0, 0.0, 0.0, 0.0,
								 0.0, 1.0, 0.0, 0.0,
								 0.0, 0.0, 1.0, 0.0,
								 0.0, 0.0, 0.0, 1.0	]);
								 
	this.rotMatY = new Matrix4D();
	this.rotMatY.populateFromArray([ 1.0, 0.0, 0.0, 0.0,
								 0.0, 1.0, 0.0, 0.0,
								 0.0, 0.0, 1.0, 0.0,
								 0.0, 0.0, 0.0, 1.0	]);

	this.rotMatZ = new Matrix4D();
	this.rotMatZ.populateFromArray([ 1.0, 0.0, 0.0, 0.0,
								 0.0, 1.0, 0.0, 0.0,
								 0.0, 0.0, 1.0, 0.0,
								 0.0, 0.0, 0.0, 1.0	]);
								 
	this.transMat = new Matrix4D();
	this.transMat.populateFromArray([ 1.0, 0.0, 0.0, 0.0,
								 0.0, 1.0, 0.0, 0.0,
								 0.0, 0.0, 1.0, 0.0,
								 0.0, 0.0, 0.0, 1.0	]);
								 
	this.stateState;
	
	//centricity calculator variables
 	this.minX = Number.POSITIVE_INFINITY;
	this.maxX = Number.NEGATIVE_INFINITY;
	this.minY = Number.POSITIVE_INFINITY;
	this.maxY = Number.NEGATIVE_INFINITY;
	this.minZ = Number.POSITIVE_INFINITY;
	this.maxZ = Number.NEGATIVE_INFINITY;	
	
	this.geometricCenter = function() {
		var rtn = new Vector();
		
		rtn.x = this.minX + this.maxX / 2.0;
		rtn.y = this.minY + this.maxY / 2.0;
		rtn.z = this.minZ + this.maxZ / 2.0;
				
		return rtn;
	}
	
	this.parseData = function(coords, polys) {
		
		//populate vertex table
		for (var index = 1; index < coords.length; ++index) {
			//grab each vertex from the array argument and store it in a mesh level table
			var thisVert = new Vector( coords[index][0], 
									   coords[index][1],
									   coords[index][2]);
			this.vertTable.push(thisVert);
			
			//check for min/max values
			if (coords[index][0] < this.minX) {this.minX = coords[index][0];}
			else if (coords[index][0] > this.maxX) {this.maxX = coords[index][0];}
		
			if (coords[index][1] < this.minY) {this.minY = coords[index][1];}
			else if (coords[index][1] > this.maxY) {this.maxY = coords[index][1];}
		
			if (coords[index][2] < this.minZ) {this.minZ = coords[index][2];}
			else if (coords[index][2] > this.maxZ) {this.maxZ =coords[index][2];}
		}
		
		//populate poly table
		for (var index = 0; index < polys.length; ++index) {
			var vertList = [];
			
			for (var coInd = 1; coInd < polys[index].length; ++coInd) {
				vertList.push(polys[index][coInd]);
			}
			
			var thisPoly = new Polygon(vertList, this);
			this.polyTable.push(thisPoly);
		}
		
		//turn polys into tris
		for (var index = 0; index < this.polyTable.length; ++index) {
			this.triTable = this.triTable.concat(this.polyTable[index].tesselate());
		}
		
		this.vertCount = 3 * this.triTable.length;
			
	}
	
	this.pushBuffer = function() {
		//populate vert buffer
		//followed by the normals assume smooth shading for now
		
		//push to buffer like we have for a ton of assignments
		for(var index = 0; index < this.triTable.length; ++index) {
			gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
			
			gl.bufferSubData(gl.ARRAY_BUFFER, (12 * (3 * index)) + this.startBufInd, this.vertTable[this.triTable[index].vertList[0]].toFloat32Array());
			gl.bufferSubData(gl.ARRAY_BUFFER, (12 * ((3 * index) + 1)) + this.startBufInd, this.vertTable[this.triTable[index].vertList[1]].toFloat32Array());
			gl.bufferSubData(gl.ARRAY_BUFFER, (12 * ((3 * index) + 2)) + this.startBufInd, this.vertTable[this.triTable[index].vertList[2]].toFloat32Array());
			
			gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
		
			gl.bufferSubData(gl.ARRAY_BUFFER, (12 * (3 * index)), this.vertTable[this.triTable[index].vertList[0]].avgNorm().toFloat32Array())
			gl.bufferSubData(gl.ARRAY_BUFFER, (12 * (3 * index + 1)) + this.startBufInd, this.vertTable[this.triTable[index].vertList[1]].avgNorm().toFloat32Array())
			gl.bufferSubData(gl.ARRAY_BUFFER, (12 * (3 * index + 2)) + this.startBufInd, this.vertTable[this.triTable[index].vertList[2]].avgNorm().toFloat32Array())
		}
		
	}
	
	this.tesselate = function() {
		this.triTable = []
		for (var index = 0; index < this.polyTable.length; ++index) {
			this.triTable = this.triTable.concat(this.polyTable[index].tesselate());
		}
	}
	
	this.scale = function(sX, sY, sZ) {
		this.scaleMat.populateFromArray(makeScale(sX, sY, sZ));
	}
	
	this.scalePercentage = function(input) {
		if(input < 0) {
			this.scaleMat.x.x = this.scaleMat.x.x * 0.95;
			this.scaleMat.y.y = this.scaleMat.y.y * 0.95;
			this.scaleMat.z.z = this.scaleMat.z.z * 0.95;
		}
		else if (input > 0) {
			this.scaleMat.x.x = this.scaleMat.x.x * 1.05;
			this.scaleMat.y.y = this.scaleMat.x.x * 1.05;
			this.scaleMat.z.z = this.scaleMat.x.x * 1.05;
		}
	}

	this.rotateX = function(angle) {
		this.rotMatX.populateFromArray(makeRotation3DX(angle));
	}
	
	this.rotateXRelative = function(angle) {
		
		var currentAngle = Math.acos(this.rotMatX.y.y);
		angle += currentAngle;
		
		this.rotMatX.populateFromArray(makeRotation3DX(angle));
		
	}
	
	
	this.rotateY = function(angle) {
		this.rotMatY.populateFromArray(makeRotation3DY(angle));	
	}
	
	this.rotateYRelative = function(angle) {

		var currentAngle = Math.acos(this.rotMatY.x.x);
		angle += currentAngle;
		
		this.rotMatY.populateFromArray(makeRotation3DY(angle));
		
	}
	
	this.rotateZ = function(angle) {
		this.rotMatZ.populateFromArray(makeRotation3DZ(angle));
	}
	
	this.rotateZRelative = function(angle) {
		var currentAngle = Math.acos(this.rotMatZ.x.x);
		angle += currentAngle;
		
		this.rotMatZ.populateFromArray(makeRotation3DZ(angle));
	}
	
	this.translate = function(dx, dy, dz) {
		this.transMat.w.x = dx;
		this.transMat.w.y = dy;
		this.transMat.w.z = dz;
	}
	
	this.translateRelative = function(dx, dy, dz) {
		this.transMat.w.x = this.startState.w.x + dx;
		this.transMat.w.y = this.startState.w.y + dy;
		this.transMat.w.z = this.startState.w.z + dz;
	}
	
	this.setStartState = function() {
		//calc transMat and store
		var glTransMat = new Matrix4D();
		glTransMat.populateFromArray([1.0, 0.0, 0.0, 0.0,
									0.0, 1.0, 0.0, 0.0,
									0.0, 0.0, 1.0, 0.0,
									0.0, 0.0, 0.0, 1.0]);
		
		glTransMat = glTransMat.matMul(this.scaleMat);
		
		glTransMat = glTransMat.matMul(this.rotMatX);
		glTransMat = glTransMat.matMul(this.rotMatY);
		glTransMat = glTransMat.matMul(this.rotMatZ);
		
		glTransMat = glTransMat.matMul(this.transMat);
		
		this.startState = glTransMat; 
	}
	
	this.render = function(isId) {
		if(this.triTable.length == 0)
			return;
		
		//things we need to differentiate
		//is it a real render? or is it an ID render
		
		if(isId) {
			//update uniform
			var flag = new Float32Array([1.0]);
 			gl.uniform1f(gl.getUniformLocation(program, "realFlag"), flag[0]);
		}
		else {
			 	//update uniform
			var flag = new Float32Array([0.0]);
 			gl.uniform1f(gl.getUniformLocation(program, "realFlag"), flag[0]);
 			
		}
		
		//set id color and tri_color
		var test = this.colorID.toFloat32Array();
		gl.uniform4fv(gl.getUniformLocation(program, "id_color"),this.colorID.toFloat32Array());
		gl.uniform4fv(gl.getUniformLocation(program, "tri_color"), this.materialColor.toFloat32Array());
		
		//set up render attributes and render
		//"uniform float isFlat;",
		gl.uniform1f(gl.getUniformLocation(program, "isFlat"), new Float32Array([0.0]));
		//"uniform float isPersp;",
		gl.uniform1f(gl.getUniformLocation(program, "isPersp"), new Float32Array([1.0])[0]);
		
		//perform matrix calculations and then push them to buffer
		var glTransMat = new Matrix4D();
		glTransMat.populateFromArray([1.0, 0.0, 0.0, 0.0,
									0.0, 1.0, 0.0, 0.0,
									0.0, 0.0, 1.0, 0.0,
									0.0, 0.0, 0.0, 1.0]);
		
		glTransMat = glTransMat.matMul(this.scaleMat);
		
		glTransMat = glTransMat.matMul(this.rotMatX);
		glTransMat = glTransMat.matMul(this.rotMatY);
		glTransMat = glTransMat.matMul(this.rotMatZ);
		
		glTransMat = glTransMat.matMul(this.transMat);
		
		//shark begins at origin, so lets just scale, then rotate, then translate.
		//awwww yeah
		//set this matrix as gl uniform
		var projMat = gl.getUniformLocation(program, "projectionMat");
		gl.uniformMatrix4fv(projMat, false, glTransMat.toFloat32Array());	
		
		//set normal matrix
		var uNorm = new Matrix4D();
		uNorm = (glTransMat.inverse()).transpose();
		var normMat = gl.getUniformLocation(program, "normalMat");
		gl.uniformMatrix4fv(normMat, false, uNorm.toFloat32Array() );
		
		//set projection matrix
		var perspMat = new Matrix4D();//perspective(90, 1, 0.1, -); //<--- this perspective worked like congress, so I made my own
		perspMat.populateFromArray([ 1.0, 0.0, 0.0, 0.0,
								 0.0, 1.0, 0.0, 0.0,
								 0.0, 0.0, 1.0, -0.2, //why 0.9? No reason.. it just looked nicer
								 0.0, 0.0, 0.0, 1.0
								 ]);
	
		//set this matrix as gl uniform
		var pMat = gl.getUniformLocation(program, "pMatrix");
		gl.uniformMatrix4fv(pMat, false, perspMat.toFloat32Array());
		projectionMatric = pMat;
		
		//now draw the mesh
		gl.drawArrays(gl.TRIANGLES, this.startInd, this.triTable.length * 3);
		
	}
}

//turn all mesh items in scene into tris
function tesselate() {
	for(var index = 0; index < meshTable.length; ++index) {
		meshTable[index].tesselate();
	}
}

//get pixel data for picking info
function  updatePixelData() {
	 arraySize = canvas.width * canvas.height * 32;
	 pixelData = new Uint8Array(arraySize);
	 gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
	 colorData = new Uint32Array(pixelData.buffer); 
};

//render and refresh all pixel data
function renderAll() {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	for (var index = 0; index < meshTable.length; ++index) {
		meshTable[index].render(true)
	}
	
	updatePixelData();
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	
	for (var index = 0; index < meshTable.length; ++index) {
		meshTable[index].render(false)
	}

}

//set mouse events
document.onmousemove = mouseMove;

//handle commands given by mouse movement events
function mouseMove(event) {
	event = event || window.event;
	mousePos = mouseCoords(event);
	
	if(initialMousePos != undefined) {
		//get pos change
		var deltaPos;
		
		
		//rotation by key combo handling
		if(qDown) {
			//rotation on X
			currentPick.rotateXRelative(0.01 * (mousePos.x - initialMousePos.x));
		}
		
		else if(wDown){
			//rotation on Y
			currentPick.rotateYRelative(0.01 * (mousePos.x - initialMousePos.x));
		}
		
		else if (eDown) {
			//rotation on Z
			currentPick.rotateZRelative(0.01 * (mousePos.x - initialMousePos.x));
		}
		//rotation by mouse handling
		else if(rDown) {
			/*
			//take mouse pos initial and convert to world coordinates
			var nX = 2 * initialPixel.x / canvas.width - 1.0;
			var nY = 1 - 2*initialPixel.y / canvas.height;
			var nZ = 0.5//2 - 1.0;
			var nW = 1.0;
			var pixelVec = new Vector4D(nX, nY, nZ, nW);
			
			//recall "gl_Position = pMatrix * projectionMat * vPosition;",
			//thus
			var perspMat = new Matrix4D();//perspective(90, 1, 0.1, -); //<--- this perspective worked like congress, so I made my own
			perspMat.populateFromArray([ 1.0, 0.0, 0.0, 0.0,
								 0.0, 1.0, 0.0, 0.0,
								 0.0, 0.0, 1.0, -0.2, //why 0.9? No reason.. it just looked nicer
								 0.0, 0.0, 0.0, 1.0
								 ]);
			perspMat = perspMat.inverse();
			
			var mvMat = currentPick.startState.copy();
			mvMat = mvMat.inverse();
			
			pixelVec = perspMat.rowVecMult(pixelVec);
			pixelVec = mvMat.rowVecMult(pixelVec)
			
			//set our project plane coordinate
			pixelVec.z = 0.5; 
			
			//shoot ray from this pixelCoordinate to the mesh's geometric center
			var rayCast = new Vector(1.0, 1.0, 1.0);
			var center = currentPick.geometricCenter();
			var mouseVec = new Vector((mousePos.x - initialMousePos.x), (initialMousePos.y - mousePos.y), 0.0 ); 
			
			rayCast.x = center.x - pixelVec.x;
			rayCast.y = center.y - pixelVec.y;
			rayCast.z = center.z - pixelVec.z;
			
			//cross product of this ray and the mouse vector is our direction of rotation.
			var rotationAxis = mouseVec.crossProduct(rayCast);
			console.log(rotationAxis);
			
			//now rotate about this axis, but I'm out of time :( )
			*/

			currentPick.rotateYRelative(0.01 * (mousePos.x - initialMousePos.x));			
			currentPick.rotateXRelative(0.01 * (initialMousePos.y - mousePos.y));
			
		}
		//scaling handling
		else if (sDown) {
			deltaPos = mousePos.x - initialMousePos.x;
			currentPick.scalePercentage(deltaPos);
		}
		else
		//translation on Z handling
		//the not sDown is a neccessary check so 
		//the shark doesn't automatically start translating when the user removes
		if (zDown) {
			deltaPos = {    x:0,
							y:0,
							z:(mousePos.x - initialMousePos.x) };
			currentPick.translateRelative(0.001 * deltaPos.x, 0.001 * deltaPos.y, 0.1 * deltaPos.z );
		}
		//translation on x/y handling
		else if (!resolvingEvent){
			deltaPos = {x:(mousePos.x - initialMousePos.x),
							y:(initialMousePos.y - mousePos.y),
							z:0 };
			currentPick.translateRelative(0.001 * deltaPos.x, 0.001 * deltaPos.y, 0.1 * deltaPos.z );
		}
		
		//as far as the user is concerned this would be better if
		//it calculated the new geometric center of the object mapped to supplied mouse coordinates
		//then determined the appropriate translation and applied it
		
		//unfortunately I don't have the dev time neccessary. Work is killing me
		if(currentPick != undefined) {
			renderAll();
		}
			
	}
	else {
	}
};

//return the coordinates of the cursor.
function mouseCoords(event) {
	if(event.pageX || event.pageY) {
		return {x:event.pageX, y:event.pageY};
	}
	
	return { x:event.clientX + document.body.scrollLeft - document.body.clientLeft,
			 y:event.clientY + document.body.scrollTop - document.body.clientTop}
};

//cArray is an array of coordinates as defined similarly to SHARK_COORD
//pArray is an array of coordiantes as defined similarly to SHARK_POLY
function addMesh(cArray, pArray) {
	//create mesh
	var idCol = gblColorID.copy();
	var matCol = new Vector4D(0.3, 0.3, 0.3, 1.0);
	var temp = new Mesh(idCol, currentVBuffInd);
	temp.materialColor = matCol;
	temp.parseData(cArray, pArray);
	temp.pushBuffer();
	temp.setStartState();
	
	var sX = (2.0)/(temp.maxX - temp.minX);
	var sY = (1.0)/(temp.maxY - temp.minY);
	var sZ = (1.2)/(temp.maxZ - temp.minZ);
	
	temp.scale(sX, sY, sZ);
	
	temp.endBufInd = temp.startBufInd + 12 * (3 * temp.triTable.length);
	currentVBuffInd = temp.endBufInd + 1;
	
	meshTable.push(temp);
	
	//increm globals
	//farm out to function that checks current color vec for color in range 0 - 1 then moves to next color component
	gblColorID.z += 0.00392;
}

//keyboard listening
window.addEventListener("keydown", function(event) {
	if(event.keyCode == 90) {
		zDown = true;
	}
	else if (event.keyCode == 83) {
		sDown = true;
	}
	else if (event.keyCode == 82) {
		rDown = true;
	}
	else if (event.keyCode == 81) {
		qDown = true;
	}
	else if (event.keyCode == 87) {
		wDown = true;
	}
	else if (event.keyCode == 69) {
		eDown = true;
	}
	else if (event.keyCode == 78) {
		addMesh(SHARK_COORD, SHARK_POLY);
	}
	
}, false);

window.addEventListener("keyup", function(event) {
	if(event.keyCode == 90) {
		zDown = false;
	}
	else if (event.keyCode == 83) {
		sDown = false;
	}
	else if (event.keyCode == 82) {
		rDown = false;
	}
	else if (event.keyCode == 81) {
		qDown = false;
	}
	else if (event.keyCode == 87) {
		wDown = false;
	}
	else if (event.keyCode == 69) {
		eDown = false;
	}
	
	resolvingEvent = true;
	
}, false);

//depreciated for slider input
function translateX() {
	if(currentPick != undefined) {
		var rangeX =  document.getElementById('tX').value;
		var rangeY = document.getElementById('tY').value;
		var rangeZ = document.getElementById('tZ').value;
		
		console.log(rangeX)
		
		currentPick.translateRelative(rangeX, rangeY, rangeZ);
		renderAll();
	}
}

//depreciated for slider input, gross
function rotateX() {
	if(currentPick != undefined) {
		var value = 0;
	}
}

//ONLOAD
window.onload = function() {
	//set state variables
	MAX_VERT_COUNT = 100000;
	gblColorID = new Vector4D(0.0, 0.0, 0.1, 1.0);
	resolvingEvent = false;
	meshTable = [];
	currentVBuffInd = 0;
	currentNBuffInd = 0;
	zDown = false;
	sDown = false;
	rDown = false;
	
	//shader code
	
vShader = [
		"attribute vec4 vPosition;",
		"attribute vec4 vNormal;",
		
		"varying vec4 fColor;",
		
		"uniform mat4  projectionMat;",
		"uniform mat4  normalMat;",
		"uniform mat4  pMatrix;",
		
		"uniform vec4  lightPosition;",
		
		"uniform vec4  tri_color;",
		"uniform vec4  id_color;",
		
		
		"uniform float realFlag;",
		"uniform float isFlat;",
		"uniform float isPersp;",
		
		"void",
		"main()",
		"{",

			
			"float glossFactor = 10.0;",
			"gl_PointSize = 1.0;",
			
			//use flag type values to triggle shader code paths
			//I think everyone is forgetting this is just C with some extra shtuff.
			"if(isPersp > 0.0) {",
    			"gl_Position = pMatrix * projectionMat * vPosition;",
			"}",
			"else {",
				"gl_Position = projectionMat * vPosition;",
			"}",
				
			//Use control to determine if this is ID or not
			"if(realFlag > 0.0) {",
				"fColor = id_color;",
			"}",
			"else {",
				"vec3 pos = (projectionMat * vPosition).xyz;",
				"vec3 light = lightPosition.xyz;",
				
				"vec3 pos_to_light = normalize(light - pos);",
				"vec3 pos_norm = normalize(normalMat * vNormal).xyz;",
				
				"vec3 reflection = normalize((-pos_to_light + (2.0 * pos_norm)));",
				"vec3 eye        = normalize(light - pos);",
				"float cos_angle = max(dot(pos_to_light, pos_norm), 0.0);",
				"float cos_alpha = max(dot(reflection, eye),0.0);",
				
				"vec4 specularComp = pow(cos_alpha, glossFactor) * tri_color;",
				"vec4 diffComp     = cos_angle * tri_color;",
				
				"if (isFlat > 0.0) {",
					"specularComp = vec4(0.0, 0.0, 0.0, 1.0);",
				"}",
				
				"fColor = specularComp + diffComp;",
				"fColor.a = 1.0;",
			"}",

    		
		"}",
	].join('\n');
	
	fShader = [
		"precision mediump float;",
		"varying vec4 fColor;",
		"void",
		"main()",
		"{",
   			"gl_FragColor = fColor;",
		"}",
	].join('\n');
	
	canvas = document.getElementById( "gl-canvas" )
	gl = WebGLUtils.setupWebGL( canvas );
	if ( !gl ) { alert( "WebGL isn't available" ); }
	
	//tell gl to do depth comparisons and update the depth buffer.
	gl.enable(gl.DEPTH_TEST);
	
	//adjust the viewport to cover the entirity of the canvas from (0,0) to upper right
	gl.viewport(0, 0, canvas.width, canvas.height);
	
	//set the clear bit
	gl.clearColor( 0.0, 0.0, 0.0, 1.0 );
	gl.clearDepth(0.0);
	gl.depthFunc(gl.GREATER);
	
	//compie shaders
    program = initShaders(gl, vShader, fShader);
	gl.useProgram( program );
	
	//set light position
	var lightSource = new Vector4D(1.0, 1.0, 1.0, 0.0);
	gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"), lightSource.toFloat32Array());
	
	
	/*
																										//TDD stuff
	var testColor = new Vector4D(1.0, 0.0, 0.0, 1.0);
	var test = new Mesh(testColor, currentVBuffInd);
	
	//populate all data
	test.parseData(SHARK_COORD, SHARK_POLY);
	test.endBufInd = test.startBufInd + 12 * (3 * test.triTable.length);
	
	testColor = new Vector4D(0.0, 1.0, 0.0, 1.0);
	currentVBuffInd += 12 * (3 * test.triTable.length) + 1;
	
	var testB = new Mesh(testColor, currentVBuffInd);
	testB.parseData(SHARK_COORD, SHARK_POLY);
	testB.endBufInd = testB.startBufInd + 12 * (3 * test.triTable.length);
	currentVBuffInd = testB.endBufInd + 1;
																										//END TDD STUFF
	*/
	
	initBuffers(12 * MAX_VERT_COUNT);
	//render a blank screen to prepare for generation
	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	
	addMesh(SHARK_COORD, SHARK_POLY);
	//addMesh(SHARK_COORD, SHARK_POLY);
	//test.pushBuffer();
	//testB.pushBuffer();
	
	
	//testB.materialColor = new Vector4D(0.3, 0.3, 0.7, 1.0);
	
	//scale and set initial conditions
	
	//var sX = (2.0)/(meshTable[1].maxX - meshTable[1].minX);
	//var sY = (1.0)/(meshTable[1].maxY - meshTable[1].minY);
	//var sZ = (1.2)/(meshTable[1].maxZ - meshTable[1].minZ);
	//test.scale(sX, sY, sZ);
	//meshTable[1].scale(0.5 * sX, 0.5 *sY, 0.5*sZ);
	
	meshTable[0].rotateX(3.141);
	meshTable[0].rotateY(1.57);
	meshTable[0].rotateZ(3.141);
	meshTable[0].translate(-0.5, -0.5, -0.5);
	
	meshTable[0].setStartState();
	//meshTable[1].setStartState();
	
	var sphereData = makeSphere(1);
	addMesh(sphereData[0], sphereData[1]);
	//meshTable[1].setStartState();
	
	
	//meshTable.push(test);
	//meshTable.push(testB);
	
	//render
	renderAll();
		
	
	//event handling
	
	
	
	
	//Modo 901 release is next week...I'm working 12 hour shifts. where is my mind
	
	//picking handler
	canvas.addEventListener("mousedown", function(event)  {
		//on mouse click transform percieved canvas pixel coordinates
		//into something we can work with.. 
		//nothing but algebraic goodness here.
		initialMousePos = mousePos;
		var rect = canvas.getBoundingClientRect();
		var pixelCoordinates = [event.clientX - rect.left, Math.floor(event.clientY - rect.top)];
		initialPixel = {x:event.clientX - rect.left, y:Math.floor(event.clientY - rect.top)}
	
		pixelCoordinates[1] = (800 - pixelCoordinates[1]) - 1;
		//bottom
		
		//pick from color table and then set as current mesh.
		
		var index = 800 * pixelCoordinates[1];
		index += pixelCoordinates[0];
		
		//construct this picked color vector
		var thisColor = new Vector4D(pixelData[4*index], pixelData[4 * index + 1], pixelData[4*index + 2], pixelData[4*index + 3]);
		console.log(thisColor);
		console.log("-----");
		
		//check mesh table for colorID equality
		for (var mshIndex = 0; mshIndex < meshTable.length; ++mshIndex) {
			var tempCol = meshTable[mshIndex].colorID.copy();
			tempCol.scale(255.0);
			tempCol.floor();
			console.log(tempCol);
			if(thisColor.equals(tempCol)) {
				currentPick = meshTable[mshIndex];
				return;
			}
		}
		
		currentPick = undefined;
		/*
		if (pixelData[4*index + 1] == 255) {
			currentPick = meshTable[1];
		}
		else if (pixelData[4*index] == 255) {
			currentPick = meshTable[0]
		}
		else {
			currentPick = undefined;
		}
		*/
		
	});
	
	//if mouse is lifted, resolve event.
	canvas.addEventListener("mouseup", function(event)  {
		initialMousePos = undefined;
		if(currentPick != undefined)
			currentPick.setStartState();
		resolvingEvent = false;
	});
	
	
	

}

