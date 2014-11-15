/*  Copyright (c) 2012 Sven "FuzzYspo0N" Bergström
	
	written by : http://underscorediscovery.com
	written for : http://buildnewgames.com/real-time-multiplayer/
	
	MIT Licensed.
*/

//The main update loop runs on requestAnimationFrame,
//Which falls back to a setTimeout loop on the server
//Code below is from Three.js, and sourced from links below

	// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
	// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

	// requestAnimationFrame polyfill by Erik Möller
	// fixes from Paul Irish and Tino el


function polygonTest(point, vs) {
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
    
    var x = point[0], y = point[1];
    
    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];
        
        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
};

function vectPoints(x,y,angle){
	var r=13
	var p=[]
	p[0]=[x+Math.sin(angle)*3*r,y+Math.cos(angle)*3*r]
	p[1]=[x+-Math.sin(angle+Math.PI/6)*4*r,y+-Math.cos(angle+Math.PI/6)*4*r]
	p[2]=[x+-Math.sin(angle)*2*r,y+-Math.cos(angle)*2*r]
	p[3]=[x+-Math.sin(angle-Math.PI/6)*4*r,y+-Math.cos(angle-Math.PI/6)*4*r]
	return p;
}	

function intersectRect(r1, r2) {
  return !(r2.left > r1.right || 
           r2.right < r1.left || 
           r2.top > r1.bottom ||
           r2.bottom < r1.top);
}

function distance(p0,p1){
	return Math.sqrt(Math.pow(p0.x-p1.x,2)+Math.pow(p0.y-p1.y,2))
}


var frame_time = 1000/60; // run the local game at 16ms / 60hz
if('undefined' != typeof(global)) frame_time = 20; //on server we run at 20ms, 50hz

( function () {

	var lastTime = 0;
	var vendors = [ 'ms', 'moz', 'webkit', 'o' ];

	for ( var x = 0; x < vendors.length && !window.requestAnimationFrame; ++ x ) {
		window.requestAnimationFrame = window[ vendors[ x ] + 'RequestAnimationFrame' ];
		window.cancelAnimationFrame = window[ vendors[ x ] + 'CancelAnimationFrame' ] || window[ vendors[ x ] + 'CancelRequestAnimationFrame' ];
	}

	if ( !window.requestAnimationFrame ) {
		window.requestAnimationFrame = function ( callback, element ) {
			var currTime = Date.now(), timeToCall = Math.max( 0, frame_time - ( currTime - lastTime ) );
			var id = window.setTimeout( function() { callback( currTime + timeToCall ); }, timeToCall );
			lastTime = currTime + timeToCall;
			return id;
		};
	}

	if ( !window.cancelAnimationFrame ) {
		window.cancelAnimationFrame = function ( id ) { clearTimeout( id ); };
	}

}() );

		//Now the main game class. This gets created on
		//both server and client. Server creates one for
		//each game that is hosted, and client creates one
		//for itself to play the game.

/* The game_core class */

var game_core = function(game_instance){
		//Store the instance, if any
	this.instance = game_instance;
		//Store a flag if we are the server
	this.server = this.instance !== undefined;
	this.ready=false
		//Used in collision etc.
	this.world = {
		width : 720,
		height : 480,
		x:0,
		y:0
	};
	this.mapIndex=0;
	this.bullets=[];
	this.pickups=[];
	this.maxPickups=5;
	this.pickupCreateRate=4000
	this.lastPickupCreate=0
	this.shieldProtectionTime=15000
	this.shieldRadius=70
		
		//We create a player set, passing them
		//the game that is running them, as well
	if(this.server) {

		this.players = {
			self : new game_player(this,this.instance.player_host),
			other : new game_player(this,this.instance.player_client)
		};

	   this.players.self.pos = {x:200,y:200};

	} else {

		this.players = {
			self : new game_player(this),
			other : new game_player(this)
		};

			//Debugging ghosts, to help visualise things
		this.ghosts = {
				//Our ghost position on the server
			server_pos_self : new game_player(this),
				//The other players server position as we receive it
			server_pos_other : new game_player(this),
				//The other players ghost destination position (the lerp)
			pos_other : new game_player(this)
		};

		this.ghosts.pos_other.state = 'dest_pos';

		this.ghosts.pos_other.info_color = 'rgba(255,255,255,0.1)';

		this.ghosts.server_pos_self.info_color = 'rgba(255,255,255,0.2)';
		this.ghosts.server_pos_other.info_color = 'rgba(255,255,255,0.2)';

		this.ghosts.server_pos_self.state = 'server_pos';
		this.ghosts.server_pos_other.state = 'server_pos';

		this.ghosts.server_pos_self.pos = { x:200, y:200 };
		this.ghosts.pos_other.pos = { x:500, y:200 };
		this.ghosts.server_pos_other.pos = { x:500, y:200 };
	}

		//The speed at which the clients move.
	this.playerspeed = 120*1.5;

		//Set up some physics integration values
	this._pdt = 0.0001;				 //The physics update delta time
	this._pdte = new Date().getTime();  //The physics update last delta time
		//A local timer for precision on server and client
	this.local_time = 0.016;			//The local timer
	this._dt = new Date().getTime();	//The local timer delta
	this._dte = new Date().getTime();   //The local timer last frame time

		//Start a physics loop, this is separate to the rendering
		//as this happens at a fixed frequency
	this.create_physics_simulation();

		//Start a fast paced timer for measuring time easier
	this.create_timer();

		//Client specific initialisation
	if(!this.server) {
		
			//Create a keyboard handler
		this.keyboard = new THREEx.KeyboardState();

			//Create the default configuration settings
		this.client_create_configuration();

			//A list of recent server updates we interpolate across
			//This is the buffer that is the driving factor for our networking
		this.server_updates = [];

			//Connect to the socket.io server!
		this.client_connect_to_server();

			//We start pinging the server to determine latency
		this.client_create_ping_timer();

			//Set their colors from the storage or locally
		
		this.players.self.color = this.color;


	} else { //if !server

		this.server_time = 0;
		this.laststate = {};

	}

}; //game_core.constructor

//server side we set the 'game_core' class to a global type, so that it can use it anywhere.
if( 'undefined' != typeof global ) {
	module.exports = global.game_core = game_core;
}

/*
	Helper functions for the game code

		Here we have some common maths and game related code to make working with 2d vectors easy,
		as well as some helpers for rounding numbers to fixed point.

*/

	// (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };
	//copies a 2d vector like object from one to another
game_core.prototype.pos = function(a) { return {x:a.x,y:a.y}; };
	//Add a 2d vector with another one and return the resulting vector
game_core.prototype.v_add = function(a,b) { return { x:(a.x+b.x).fixed(), y:(a.y+b.y).fixed() }; };
	//Subtract a 2d vector with another one and return the resulting vector
game_core.prototype.v_sub = function(a,b) { return { x:(a.x-b.x).fixed(),y:(a.y-b.y).fixed() }; };
	//Multiply a 2d vector with a scalar value and return the resulting vector
game_core.prototype.v_mul_scalar = function(a,b) { return {x: (a.x*b).fixed() , y:(a.y*b).fixed() }; };
	//For the server, we need to cancel the setTimeout that the polyfill creates
game_core.prototype.stop_update = function() {  window.cancelAnimationFrame( this.updateid );  };
	//Simple linear interpolation
game_core.prototype.lerp = function(p, n, t) { var _t = Number(t); _t = (Math.max(0, Math.min(1, _t))).fixed(); return (p + _t * (n - p)).fixed(); };
	//Simple linear interpolation between 2 vectors
game_core.prototype.v_lerp = function(v,tv,t) { return { x: this.lerp(v.x, tv.x, t), y:this.lerp(v.y, tv.y, t) }; };

/*
	The player class

		A simple class to maintain state of a player on screen,
		as well as to draw that state when required.
*/

	var game_player = function( game_instance, player_instance ) {

			//Store the instance, if any
		this.instance = player_instance;
		this.game = game_instance;

			//Set up initial values for our state information
		this.pos = { x:0, y:0 };
		this.angle=0
		this.size = { hx:16, hy:16 };
		this.state = 'not-connected';
		this.color = 'rgba(255,255,255,0.1)';
		this.info_color = 'rgba(255,255,255,0.1)';
		this.health=100;
		this.max_health=100;
		this.id = '';
		this.lastSendDate=0;
		this.shieldProtection=0;

			//These are used in moving us around later
		this.old_state = {pos:{x:0,y:0}};
		this.cur_state = {pos:{x:0,y:0}};
		this.state_time = new Date().getTime();

			//Our local history of inputs
		this.inputs = [];

			//The world bounds we are confined to
		this.pos_limits = {
			x_min: this.size.hx,
			x_max: this.game.world.width - this.size.hx,
			y_min: this.size.hy,
			y_max: this.game.world.height - this.size.hy
		};

			//The 'host' of a game gets created with a player instance since
			//the server already knows who they are. If the server starts a game
			//with only a host, the other player is set up in the 'else' below
		if(player_instance) {
			this.pos = { x:200, y:200 };
		} else {
			this.pos = { x:500, y:200 };
		}

	}; //game_player.constructor
  
	game_player.prototype.draw = function(){
		
		vect(game.ctx,this.pos.x-game.world.x,this.pos.y-game.world.y,this.angle,this.color)
		
		game.ctx.fillStyle = this.info_color;
		game.ctx.shadowColor = ''
		game.ctx.shadowBlur = 0;
		game.ctx.fillText(this.state, this.pos.x+10-game.world.x, this.pos.y + 4-game.world.y);
	
	}; //game_player.draw

/*

 Common functions
 
	These functions are shared between client and server, and are generic
	for the game state. The client functions are client_* and server functions
	are server_* so these have no prefix.

*/

	//Main update loop
game_core.prototype.update = function(t) {
	
		//Work out the delta time
	this.dt = this.lastframetime ? ( (t - this.lastframetime)/1000.0).fixed() : 0.016;
	//console.log(this.dt)
		//Store the last frame time
	this.lastframetime = t;

	//updates bullets
	
	for(var i in this.bullets){
		this.bullets[i].x+=Math.sin(this.bullets[i].angle)*this.dt*400
		this.bullets[i].y+=Math.cos(this.bullets[i].angle)*this.dt*400

		//get rid of bullet that are off the map
		if(0>this.bullets[i].x || 0>this.bullets[i].y || this.world.width<this.bullets[i].x || this.world.height<this.bullets[i].y){
			if(this.server)this.broadcast('s.d.'+this.bullets[i].ID)
			this.bullets.splice(i,1)
			continue;
		}
		
		//if bullet hits one of the blocks
		var map=maps[this.mapIndex]
		if(map.layers.map.data[Math.floor(this.bullets[i].y/48)*map.width+Math.floor(this.bullets[i].x/48)]){
			if(this.server)this.broadcast('s.d.'+this.bullets[i].ID)
			this.bullets.splice(i,1)
			continue;
		}
		
		
		if(distance(this.bullets[i],this.players.self.pos)<this.shieldRadius && 
		new Date()-this.players.self.shieldProtection<this.shieldProtectionTime 
		&& this.server && !this.bullets[i].host){
			this.bullets[i].angle+=Math.PI;
			this.bullets[i].host=!this.bullets[i].host
			this.broadcast('s.m.'+this.bullets[i].ID+'@'+
								  this.bullets[i].host+'@'+
							      this.bullets[i].x+'@'+
							      this.bullets[i].y+'@'+
							      this.bullets[i].angle)
			continue;
		}
		
		if(distance(this.bullets[i],this.players.other.pos)<this.shieldRadius && 
		new Date()-this.players.other.shieldProtection<this.shieldProtectionTime 
		&& this.server && this.bullets[i].host){
			this.bullets[i].angle+=Math.PI;
			this.bullets[i].host=!this.bullets[i].host;
			this.broadcast('s.m.'+this.bullets[i].ID+'@'+
								  this.bullets[i].host+'@'+
							      this.bullets[i].x+'@'+
							      this.bullets[i].y+'@'+
							      this.bullets[i].angle)
			continue;
		}
		
		//if bullet hitting one of the players
		if( polygonTest([this.bullets[i].x,this.bullets[i].y],
			vectPoints(this.players.self.pos.x,this.players.self.pos.y,this.players.self.angle))){
			//console.log(vectPoints(this.players.self.pos.x,this.players.self.pos.y,this.players.self.angle))
			if(this.server && !this.bullets[i].host){
				//console.log(this.players.self)
				this.broadcast('s.d.'+this.bullets[i].ID)
				this.players.self.health-=3;
				this.broadcast('s.k.1@'+this.players.self.health)
				if(this.players.self.health<=0){
					this.end()
					return ;
				}
				this.bullets.splice(i,1)
				continue;
			}		
		}
		
		if(polygonTest([this.bullets[i].x,this.bullets[i].y],
			vectPoints(this.players.other.pos.x,this.players.other.pos.y,this.players.other.angle))){
			//console.log(vectPoints(this.players.self.pos.x,this.players.self.pos.y,this.players.self.angle))
			if(this.server && this.bullets[i].host){
				//console.log(this.players.other)
				this.broadcast('s.d.'+this.bullets[i].ID)
				this.players.other.health-=5;
				this.broadcast('s.k.0@'+this.players.other.health)
				if(this.players.other.health<=0){
					this.end()
					return ;
				}
				this.bullets.splice(i,1)
				continue;
			}
			continue;
		}

	}
	
	//Update the game specifics

	if(!this.server) {
		this.client_update();
	} else {
		this.server_update();
	}
	
	//theres bug a in the physics or something where the player goes off the map
	//this is here to fix that
	this.check_collision( this.players.self );
	this.check_collision( this.players.other );

		//schedule the next update
	this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );

}; //game_core.update


/*
	Shared between server and client.
	In this example, `item` is always of type game_player.
*/
game_core.prototype.check_collision = function( item ) {

		//Left wall.
	if(item.pos.x < item.pos_limits.x_min) {
		item.pos.x = item.pos_limits.x_min;
	}

		//Right wall
	if(item.pos.x > item.pos_limits.x_max ) {
		item.pos.x = item.pos_limits.x_max;
	}
	
		//Roof wall.
	if(item.pos.y < item.pos_limits.y_min) {
		item.pos.y = item.pos_limits.y_min;
	}

		//Floor wall
	if(item.pos.y > item.pos_limits.y_max ) {
		item.pos.y = item.pos_limits.y_max;
	}
	
		//Fixed point helps be more deterministic
	item.pos.x = item.pos.x.fixed(4);
	item.pos.y = item.pos.y.fixed(4);
	
}; //game_core.check_collision


game_core.prototype.process_input = function( player ) {

	//It's possible to have recieved multiple inputs by now,
	//so we process each one
	var x_dir = 0;
	var y_dir = 0;
	var ic = player.inputs.length;
	if(ic) {
		for(var j = 0; j < ic; ++j) {
				//don't process ones we already have simulated locally
			if(player.inputs[j].seq <= player.last_input_seq) continue;

			var input = player.inputs[j].inputs;
			var c = input.length;
			for(var i = 0; i < c; ++i) {
				var key = input[i];
				if(key == 'l') {
					x_dir -= 1;
				}
				if(key == 'r') {
					x_dir += 1;
				}
				if(key == 'd') {
					y_dir += 1;
				}
				if(key == 'u') {
					y_dir -= 1;
				}
			} //for all input values

		} //for each input command
	} //if we have inputs

		//we have a direction vector now, so apply the same physics as the client
	var resulting_vector = this.physics_movement_vector_from_direction(x_dir,y_dir);
	if(player.inputs.length) {
		//we can now clear the array since these have been processed

		player.last_input_time = player.inputs[ic-1].time;
		player.last_input_seq = player.inputs[ic-1].seq;
	}
	var _player = {
		x:Math.floor((player.pos.x+resulting_vector.y)/48),
		y:Math.floor((player.pos.y+resulting_vector.x)/48),		
		top:(player.pos.y-player.size.hy)+resulting_vector.y,
		
		left:(player.pos.x-player.size.hx)+resulting_vector.x,
		
		bottom:(player.pos.y+player.size.hy)+resulting_vector.y,
		
		right:(player.pos.x+player.size.hx)+resulting_vector.x
	}
	
	//prevents player from into blocks
	var map=maps[this.mapIndex]
	for(var x=_player.x-1;x<_player.x+1;x++){
		for(var y=_player.y-1;y<_player.y+1;y++){
			if(y<0 || x<0 || x>map.width || y>map.height)continue;
	
			var block={
				top:y*48,
				left:x*48,
				bottom:y*48+48,
				right:x*48+48
			}
			var index=y*map.width+x
			if(map.layers.map.data[index] && intersectRect(_player,block) && this.server){
				
				if(player.pos.y<block.bottom){
					resulting_vector.y=-Math.abs(resulting_vector.y)		

				}
				else if(player.pos.y>block.top){
					resulting_vector.y=Math.abs(resulting_vector.y)
				}
				if(player.pos.x<block.right){
					resulting_vector.x=-Math.abs(resulting_vector.x)		

				}
				else if(player.pos.x>block.left){
					resulting_vector.x=Math.abs(resulting_vector.x)
				}
				return resulting_vector
			}
		}
	}
		//give it back
	return resulting_vector;

}; //game_core.process_input

game_core.prototype.physics_movement_vector_from_direction = function(x,y) {

		//Must be fixed step, at physics sync speed.
	return {
		x : (x * (this.playerspeed * 0.015)).fixed(3),
		y : (y * (this.playerspeed * 0.015)).fixed(3)
	};

}; //game_core.physics_movement_vector_from_direction

game_core.prototype.update_physics = function() {

	if(this.server) {
		this.server_update_physics();
	} else {
		this.client_update_physics();
	}

}; //game_core.prototype.update_physics

/*

 Server side functions
 
	These functions below are specific to the server side only,
	and usually start with server_* to make things clearer.

*/

	//Updated at 15ms , simulates the world state
game_core.prototype.server_update_physics = function() {

		//Handle player one
	this.players.self.old_state.pos = this.pos( this.players.self.pos );
	var new_dir = this.process_input(this.players.self);
	this.players.self.pos = this.v_add( this.players.self.old_state.pos, new_dir );

		//Handle player two
	this.players.other.old_state.pos = this.pos( this.players.other.pos );
	var other_new_dir = this.process_input(this.players.other);
	this.players.other.pos = this.v_add( this.players.other.old_state.pos, other_new_dir);

		//Keep the physics position in the world
	//console.log(this.players.self.pos.x)
	this.check_collision( this.players.self );
	this.check_collision( this.players.other );

	this.players.self.inputs = []; //we have cleared the input buffer, so remove this
	this.players.other.inputs = []; //we have cleared the input buffer, so remove this

}; //game_core.server_update_physics

	//Makes sure things run smoothly and notifies clients of changes
	//on the server side
game_core.prototype.server_update = function(){

		//Update the state of our local clock to match the timer
	this.server_time = this.local_time;

		//Make a snapshot of the current state, for updating the clients
	this.laststate = {
		hp  : this.players.self.pos,				//'host position', the game creators position
		cp  : this.players.other.pos,			   //'client position', the person that joined, their position
		his : this.players.self.last_input_seq,	 //'host input sequence', the last input we processed for the host
		cis : this.players.other.last_input_seq,	//'client input sequence', the last input we processed for the client
		t   : this.server_time					  // our current local time on the server
	};

		//Send the snapshot to the 'host' player
	if(this.players.self.instance) {
		this.players.self.instance.emit( 'onserverupdate', this.laststate );
	}

		//Send the snapshot to the 'client' player
	if(this.players.other.instance) {
		this.players.other.instance.emit( 'onserverupdate', this.laststate );
	}

	//create pickups
	if(new Date()-this.lastPickupCreate>this.pickupCreateRate && this.pickups.length<this.maxPickups && this.ready){
		this.lastPickupCreate=new Date()
		var map=maps[this.mapIndex]
		var start=map.starts[Math.floor(Math.random()*map.starts.length)]
		var ID=Math.random()+''
		var types=['health','shield']
		var type=types[Math.floor(Math.random()*types.length)]
		this.pickups.push({type:type,x:start.x,y:start.y,ID:ID})
		this.broadcast('s.i.c@'+ID+'@'+start.x+'@'+start.y+'@'+type)
	}
	//check if player pick something up
	
	for(var i in this.pickups){
		var pickup=this.pickups[i]
		var _pickup={
			top:pickup.y,
			left:pickup.x,
			bottom:pickup.y+48,
			right:pickup.x+48
			
		}
		
		for(var z in this.players){
			var player=this.players[z]

			var _player={
				left:player.pos.x-player.size.hx,
				top:player.pos.y-player.size.hy,
				right:player.pos.x+player.size.hx,
				bottom:player.pos.y+player.size.hy
			}

			if(intersectRect(_pickup,_player)){
				var host=(z=='self')*1;
				
				if(pickup.type=='health'){
					if(player.health>=player.max_health)continue;
					player.health+=25;
					if(player.max_health<player.health)player.health=player.max_health
					this.broadcast('s.k.'+host+'@'+player.health)
				}else if(pickup.type=='shield'){
					player.shieldProtection=new Date()
				}
				
				this.broadcast('s.i.d@'+host+'@'+pickup.ID)
				this.pickups.splice(i,1)
				continue;
			}
		}

	}
}; //game_core.server_update


game_core.prototype.handle_server_input = function(client, input, input_time, input_seq) {

		//Fetch which client this refers to out of the two
	var player_client =
		(client.userid == this.players.self.instance.userid) ?
			this.players.self : this.players.other;

		//Store the input on the player instance for processing in the physics loop
   player_client.inputs.push({inputs:input, time:input_time, seq:input_seq});

}; //game_core.handle_server_input

game_core.prototype.create_timer = function(){
	setInterval(function(){
		this._dt = new Date().getTime() - this._dte;
		this._dte = new Date().getTime();
		this.local_time += this._dt/1000.0;
	}.bind(this), 4);
}

game_core.prototype.create_physics_simulation = function() {

	setInterval(function(){
		this._pdt = (new Date().getTime() - this._pdte)/1000.0;
		this._pdte = new Date().getTime();
		this.update_physics();
	}.bind(this), 15);

}; //game_core.client_create_physics_simulation
