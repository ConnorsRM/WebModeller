///main.js


//contexts and shader programs
var gl;
var program;

//global level buffer variables
var vBuffer;
var cBuffer;
var vPosition;
var vColor;
var nBuffer;

//State Variables

//global tables
var vertTable;
var currentColorID;


var VERTEX_MAX;

/*
 * 
 *	Triangle
 * 
 */

function Triangle() {
	this.vertexList = [];
	this.color = Vector4D(1.0, 1.0, 1.0, 1.0);
	
	//container class link
	this.parentPoly;
	
	this.normal = function() {
		var vecA = vertTable[this.vertexList[1]].sub(vertTable[this.vertexList[0]]);
		var vecB = vertTable[this.vertexList[2]].sub(vertTable[this.vertexList[0]]);
		var rtn = vecA.crossProduct(vecB);
		
		return rtn;
		
	}
	
	
}


function Polygon() {
	this.vertexList = [];
	this.triTable = [];
	
	this.color = Vector4D(1.0, 1.0, 1.0, 1.0);
	this.materialColor;
	
	this.parentMesh;
	
	this.normal = function() {
		//returns normal of polygon
	}
	
	
}

function Mesh() {
	this.vertTable = [];
	this.polyTable = [];
	
	this.colorID;
	this.materialColor;
}


//just a pass through for now.
window.onload = function init() {
	VERTEX_MAX = 125000;
	
	//compile gl shaders
		//fragment shader, assign all verts white
	fShader = [
		"precision mediump float;",

		"void",
		"main()",
		"{",
   			"gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 );",
		"}",
	].join('\n');
	
	
	//vertex shader, no longer passthrough
	//this has a uniform 4D matrix that will be applied to vertices processed
	//in this pipeline.
	vShader = [
		"attribute vec4 vPosition;",
		"uniform   mat4 projectionMat;",
		
		"void",
		"main()",
		"{",
			"gl_PointSize = 1.0;",
    		"gl_Position = projectionMat * vPosition;",
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

	
	
	program = initShaders(gl, vShader, fShader);
	gl.useProgram(program);
	
	//render a blank screen to prepare for generation
	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}
