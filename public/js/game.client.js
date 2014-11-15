
/*

 Client side functions

	These functions below are specific to the client side only,
	and usually start with client_* to make things clearer.

*/

game_core.prototype.client_handle_input = function(){

	//if(this.lit > this.local_time) return;
	//this.lit = this.local_time+0.5; //one second delay

		//This takes input from the client and keeps a record,
		//It also sends the input information to the server immediately
		//as it is pressed. It also tags each input with a sequence number.

	var x_dir = 0;
	var y_dir = 0;
	var input = [];
	this.client_has_input = false;

	if( this.keyboard.pressed('A') ||
		this.keyboard.pressed('left')) {

			x_dir = -1;
			input.push('l');

		} //left

	if( this.keyboard.pressed('D') ||
		this.keyboard.pressed('right')) {

			x_dir = 1;
			input.push('r');

		} //right

	if( this.keyboard.pressed('S') ||
		this.keyboard.pressed('down')) {

			y_dir = 1;
			input.push('d');

		} //down

	if( this.keyboard.pressed('W') ||
		this.keyboard.pressed('up')) {

			y_dir = -1;
			input.push('u');

		} //up

	if(input.length) {

			//Update what sequence we are on now
		this.input_seq += 1;

			//Store the input state as a snapshot of what happened.
		this.players.self.inputs.push({
			inputs : input,
			time : this.local_time.fixed(3),
			seq : this.input_seq
		});

			//Send the packet of information to the server.
			//The input packets are labelled with an 'i' in front.
		var server_packet = 'i.';
			server_packet += input.join('-') + '.';
			server_packet += this.local_time.toFixed(3).replace('.','-') + '.';
			server_packet += this.input_seq;

			//Go
		this.socket.send(  server_packet  );

			//Return the direction if needed
		return this.physics_movement_vector_from_direction( x_dir, y_dir );

	} else {

		return {x:0,y:0};

	}

}; //game_core.client_handle_input

game_core.prototype.client_process_net_prediction_correction = function() {

		//No updates...
	if(!this.server_updates.length) return;

		//The most recent server update
	var latest_server_data = this.server_updates[this.server_updates.length-1];

		//Our latest server position
	var my_server_pos = this.players.self.host ? latest_server_data.hp : latest_server_data.cp;

		//Update the debug server position block
	this.ghosts.server_pos_self.pos = this.pos(my_server_pos);

			//here we handle our local input prediction ,
			//by correcting it with the server and reconciling its differences

		var my_last_input_on_server = this.players.self.host ? latest_server_data.his : latest_server_data.cis;
		if(my_last_input_on_server) {
				//The last input sequence index in my local input list
			var lastinputseq_index = -1;
				//Find this input in the list, and store the index
			for(var i = 0; i < this.players.self.inputs.length; ++i) {
				if(this.players.self.inputs[i].seq == my_last_input_on_server) {
					lastinputseq_index = i;
					break;
				}
			}

				//Now we can crop the list of any updates we have already processed
			if(lastinputseq_index != -1) {
				//so we have now gotten an acknowledgement from the server that our inputs here have been accepted
				//and that we can predict from this known position instead

					//remove the rest of the inputs we have confirmed on the server
				var number_to_clear = Math.abs(lastinputseq_index - (-1));
				this.players.self.inputs.splice(0, number_to_clear);
					//The player is now located at the new server position, authoritive server
				this.players.self.cur_state.pos = this.pos(my_server_pos);
				this.players.self.last_input_seq = lastinputseq_index;
					//Now we reapply all the inputs that we have locally that
					//the server hasn't yet confirmed. This will 'keep' our position the same,
					//but also confirm the server position at the same time.
				this.client_update_physics();
				this.client_update_local_position();

			} // if(lastinputseq_index != -1)
		} //if my_last_input_on_server

}; //game_core.client_process_net_prediction_correction

game_core.prototype.client_process_net_updates = function() {

		//No updates...
	if(!this.server_updates.length) return;

	//First : Find the position in the updates, on the timeline
	//We call this current_time, then we find the past_pos and the target_pos using this,
	//searching throught the server_updates array for current_time in between 2 other times.
	// Then :  other player position = lerp ( past_pos, target_pos, current_time );

		//Find the position in the timeline of updates we stored.
	var current_time = this.client_time;
	var count = this.server_updates.length-1;
	var target = null;
	var previous = null;

		//We look from the 'oldest' updates, since the newest ones
		//are at the end (list.length-1 for example). This will be expensive
		//only when our time is not found on the timeline, since it will run all
		//samples. Usually this iterates very little before breaking out with a target.
	for(var i = 0; i < count; ++i) {

		var point = this.server_updates[i];
		var next_point = this.server_updates[i+1];

			//Compare our point in time with the server times we have
		if(current_time > point.t && current_time < next_point.t) {
			target = next_point;
			previous = point;
			break;
		}
	}

		//With no target we store the last known
		//server position and move to that instead
	if(!target) {
		target = this.server_updates[0];
		previous = this.server_updates[0];
	}

		//Now that we have a target and a previous destination,
		//We can interpolate between then based on 'how far in between' we are.
		//This is simple percentage maths, value/target = [0,1] range of numbers.
		//lerp requires the 0,1 value to lerp to? thats the one.

	 if(target && previous) {

		this.target_time = target.t;

		var difference = this.target_time - current_time;
		var max_difference = (target.t - previous.t).fixed(3);
		var time_point = (difference/max_difference).fixed(3);

			//Because we use the same target and previous in extreme cases
			//It is possible to get incorrect values due to division by 0 difference
			//and such. This is a safe guard and should probably not be here. lol.
		if( isNaN(time_point) ) time_point = 0;
		if(time_point == -Infinity) time_point = 0;
		if(time_point == Infinity) time_point = 0;

			//The most recent server update
		var latest_server_data = this.server_updates[ this.server_updates.length-1 ];

			//These are the exact server positions from this tick, but only for the ghost
		var other_server_pos = this.players.self.host ? latest_server_data.cp : latest_server_data.hp;

			//The other players positions in this timeline, behind us and in front of us
		var other_target_pos = this.players.self.host ? target.cp : target.hp;
		var other_past_pos = this.players.self.host ? previous.cp : previous.hp;

			//update the dest block, this is a simple lerp
			//to the target from the previous point in the server_updates buffer
		this.ghosts.server_pos_other.pos = this.pos(other_server_pos);
		this.ghosts.pos_other.pos = this.v_lerp(other_past_pos, other_target_pos, time_point);

		if(this.client_smoothing) {
			this.players.other.pos = this.v_lerp( this.players.other.pos, this.ghosts.pos_other.pos, this._pdt*this.client_smooth);
		} else {
			this.players.other.pos = this.pos(this.ghosts.pos_other.pos);
		}

			//Now, if not predicting client movement , we will maintain the local player position
			//using the same method, smoothing the players information from the past.
		if(!this.client_predict && !this.naive_approach) {

				//These are the exact server positions from this tick, but only for the ghost
			var my_server_pos = this.players.self.host ? latest_server_data.hp : latest_server_data.cp;

				//The other players positions in this timeline, behind us and in front of us
			var my_target_pos = this.players.self.host ? target.hp : target.cp;
			var my_past_pos = this.players.self.host ? previous.hp : previous.cp;

				//Snap the ghost to the new server position
			this.ghosts.server_pos_self.pos = this.pos(my_server_pos);
			var local_target = this.v_lerp(my_past_pos, my_target_pos, time_point);

				//Smoothly follow the destination position
			if(this.client_smoothing) {
				this.players.self.pos = this.v_lerp( this.players.self.pos, local_target, this._pdt*this.client_smooth);
			} else {
				this.players.self.pos = this.pos( local_target );
			}
		}

	} //if target && previous

}; //game_core.client_process_net_updates

game_core.prototype.client_onserverupdate_recieved = function(data){

			//Lets clarify the information we have locally. One of the players is 'hosting' and
			//the other is a joined in client, so we name these host and client for making sure
			//the positions we get from the server are mapped onto the correct local sprites
		var player_host = this.players.self.host ?  this.players.self : this.players.other;
		var player_client = this.players.self.host ?  this.players.other : this.players.self;
		var this_player = this.players.self;
		
			//Store the server time (this is offset by the latency in the network, by the time we get it)
		this.server_time = data.t;
			//Update our local offset time from the last server update
		this.client_time = this.server_time - (this.net_offset/1000);

			//One approach is to set the position directly as the server tells you.
			//This is a common mistake and causes somewhat playable results on a local LAN, for example,
			//but causes terrible lag when any ping/latency is introduced. The player can not deduce any
			//information to interpolate with so it misses positions, and packet loss destroys this approach
			//even more so. See 'the bouncing ball problem' on Wikipedia.

		if(this.naive_approach) {

			if(data.hp) {
				player_host.pos = this.pos(data.hp);
			}

			if(data.cp) {
				player_client.pos = this.pos(data.cp);
			}

		} else {

				//Cache the data from the server,
				//and then play the timeline
				//back to the player with a small delay (net_offset), allowing
				//interpolation between the points.
			this.server_updates.push(data);

				//we limit the buffer in seconds worth of updates
				//60fps*buffer seconds = number of samples
			if(this.server_updates.length >= ( 60*this.buffer_size )) {
				this.server_updates.splice(0,1);
			}

				//We can see when the last tick we know of happened.
				//If client_time gets behind this due to latency, a snap occurs
				//to the last tick. Unavoidable, and a reallly bad connection here.
				//If that happens it might be best to drop the game after a period of time.
			this.oldest_tick = this.server_updates[0].t;

				//Handle the latest positions from the server
				//and make sure to correct our local predictions, making the server have final say.
			this.client_process_net_prediction_correction();
			
		} //non naive

}; //game_core.client_onserverupdate_recieved

game_core.prototype.client_update_local_position = function(){

 if(this.client_predict) {

			//Work out the time we have since we updated the state
		var t = (this.local_time - this.players.self.state_time) / this._pdt;

			//Then store the states for clarity,
		var old_state = this.players.self.old_state.pos;
		var current_state = this.players.self.cur_state.pos;

			//Make sure the visual position matches the states we have stored
		//this.players.self.pos = this.v_add( old_state, this.v_mul_scalar( this.v_sub(current_state,old_state), t )  );
		this.players.self.pos = current_state;
		
			//We handle collision on client if predicting.
		this.check_collision( this.players.self );

	}  //if(this.client_predict)

}; //game_core.prototype.client_update_local_position

game_core.prototype.client_update_physics = function() {

		//Fetch the new direction from the input buffer,
		//and apply it to the state so we can smooth it in the visual state

	if(this.client_predict) {

		this.players.self.old_state.pos = this.pos( this.players.self.cur_state.pos );
		var nd = this.process_input(this.players.self);
		this.players.self.cur_state.pos = this.v_add( this.players.self.old_state.pos, nd);
		this.players.self.state_time = this.local_time;

	}

}; //game_core.client_update_physics

game_core.prototype.client_update = function() {

		//Clear the screen area
	this.ctx.clearRect(0,0,this.viewport.width,viewport.height);
	
	
	if(this.ready){
		this.viewport.style.backgroundImage=''
	}else{
		this.viewport.style.backgroundImage='url(imgs/searching.png)'
		this.viewport.style.backgroundSize='100% auto'
		this.viewport.style.backgroundRepeat='no-repeat'
		this.viewport.style.backgroundPosition='center center'
		return ;
	}
	//move the map camera
	var sensitivity=300
	var move=0
	if(0<this.playerspeed*this.dt)move=this.playerspeed*this.dt
	
	if(this.players.self.pos.x>this.world.x+sensitivity)this.world.x+=move
	if(this.players.self.pos.y>this.world.y+sensitivity)this.world.y+=move
	if(this.players.self.pos.x<(this.world.x-sensitivity)+this.viewport.width)this.world.x-=move
	if(this.players.self.pos.y<(this.world.y-sensitivity)+this.viewport.height)this.world.y-=move
	
	if(this.world.x<0)this.world.x=0
	if(this.world.y<0)this.world.y=0
	if(this.world.x>this.world.width-this.viewport.width)this.world.x=this.world.width-this.viewport.width
	if(this.world.y>this.world.height-this.viewport.height)this.world.y=this.world.height-this.viewport.height
	
	for(var i=0;i<maps[this.mapIndex].layers.length;i++){
		displayLayer(this.ctx,-this.world.x,-this.world.y,maps[this.mapIndex].layers[i])
	}
	
	
	for(var i=0;i<this.pickups.length;i++){
		pickups[this.pickups[i].type](this.ctx,this.pickups[i].x-this.world.x,this.pickups[i].y-this.world.y)
	}
		
		//Capture inputs from the player
	this.client_handle_input();

		//Network player just gets drawn normally, with interpolation from
		//the server updates, smoothing out the positions from the past.
		//Note that if we don't have prediction enabled - this will also
		//update the actual local client position on screen as well.
	if( !this.naive_approach ) {
		this.client_process_net_updates();
	}
		
		//Now they should have updated, we can draw the entity
	this.players.other.color='red'
	this.players.other.draw();

		//When we are doing client side prediction, we smooth out our position
		//across frames using local input states we have stored.
	this.client_update_local_position();


	this.players.self.color='blue'
	this.players.self.angle=Math.PI/2-Math.atan2(mouse.y - (this.players.self.pos.y-this.world.y ), mouse.x - (this.players.self.pos.x-this.world.x));

	this.players.self.draw();
	
	//draws bullets
	for(var i in this.bullets){
		this.ctx.shadowColor = 'yellow'
		this.ctx.save();
		this.ctx.translate(this.bullets[i].x-this.world.x,this.bullets[i].y-this.world.y);
		this.ctx.rotate(-this.bullets[i].angle);
		this.ctx.beginPath();
		this.ctx.rect(-3,-3, 6, 6);
		this.ctx.fillStyle = 'yellow';
		this.ctx.fill();
		this.ctx.restore();
	}

	
	//display shields
	if(new Date()-this.players.self.shieldProtection<this.shieldProtectionTime){
		this.ctx.beginPath();
		this.ctx.arc(this.players.self.pos.x-this.world.x,
					 this.players.self.pos.y-this.world.y,
					 this.shieldRadius, 0, 2 * Math.PI, false);
		this.ctx.lineWidth = 2;
		this.ctx.strokeStyle = 'blue';
		this.ctx.shadowBlur = 10;
		this.ctx.shadowColor = 'blue'
		this.ctx.stroke();
		pickups.shield(this.ctx,10,30)
		
		var seconds=Math.floor((this.shieldProtectionTime-(new Date()-this.players.self.shieldProtection))/1000)+1
		if(seconds<10)seconds='0'+seconds
		this.ctx.strokeStyle = '';
		this.ctx.shadowBlur = 0;
		this.ctx.font = '16pt Calibri';
		this.ctx.fillStyle = this.players.self.info_color;	
		this.ctx.textAlign = 'left';
		this.ctx.fillText('0:'+seconds, 60, 60);
	
	}
	
	if(new Date()-this.players.other.shieldProtection<this.shieldProtectionTime){
		this.ctx.beginPath();
		this.ctx.arc(this.players.other.pos.x-this.world.x, 
					 this.players.other.pos.y-this.world.y, 
					 this.shieldRadius, 0, 2 * Math.PI, false);
		this.ctx.lineWidth = 2;
		this.ctx.strokeStyle = '#2A5BFF';
		this.ctx.shadowBlur = 10;
		this.ctx.shadowColor = '#2A5BFF'
		this.ctx.stroke();
		
		pickups.shield(this.ctx,game.viewport.width-58,30)
		
		var seconds=Math.floor((this.shieldProtectionTime-(new Date()-this.players.other.shieldProtection))/1000)+1
		if(seconds<10)seconds='0'+seconds
		this.ctx.strokeStyle = '';
		this.ctx.shadowBlur = 0;
		this.ctx.font = '16pt Calibri';
		this.ctx.fillStyle = this.players.other.info_color;	
		this.ctx.textAlign = 'right';
		this.ctx.fillText('0:'+seconds, game.viewport.width-60, 60);
	}
	
		
	//player display health bar
	{
		this.ctx.beginPath();
		this.ctx.shadowColor = ''
		this.ctx.shadowBlur = 0;
		this.ctx.rect(10, 10, 150,20);
		this.ctx.lineWidth = 3;
		this.ctx.strokeStyle = '#333';
		this.ctx.stroke();
	
		this.ctx.beginPath();
		this.ctx.rect(10, 10, (this.players.self.health/this.players.self.max_health)*150,20);
		this.ctx.fillStyle = 'blue';
		this.ctx.fill();
		
		this.ctx.font = '11pt Calibri';
		this.ctx.fillStyle = this.players.self.info_color;	
		this.ctx.textAlign = 'left';
		this.ctx.fillText(this.players.self.state, 170, 25);
	}
	//opponent display health bar
	{	
		this.ctx.beginPath();
		this.ctx.shadowColor = ''
		this.ctx.shadowBlur = 0;
		this.ctx.rect(viewport.width-160,10, 150,20);
		this.ctx.lineWidth = 3;
		this.ctx.strokeStyle = '#333';
		this.ctx.stroke();
	
		this.ctx.beginPath();
		this.ctx.rect(viewport.width-160,10, (this.players.other.health/this.players.other.max_health)*150,20);
		this.ctx.fillStyle = 'red';
		this.ctx.fill();
	
		//this.ctx.font = '11pt Calibri';
		this.ctx.fillStyle = this.players.other.info_color;	
		this.ctx.textAlign = 'right';
		this.ctx.fillText(this.players.other.state, viewport.width-170, 25);
	}


	//Work out the fps average

	this.client_refresh_fps();


}; //game_core.update_client

game_core.prototype.client_create_ping_timer = function() {

		//Set a ping timer to 1 second, to maintain the ping/latency between
		//client and server and calculated roughly how our connection is doing

	setInterval(function(){

		this.last_ping_time = new Date().getTime() - this.fake_lag;
		this.socket.send('p.' + (this.last_ping_time) );

	}.bind(this), 1000);
	
}; //game_core.client_create_ping_timer

game_core.prototype.client_create_configuration = function() {
	this.naive_approach = false;		//Whether or not to use the naive approach
	this.show_server_pos = false;	   //Whether or not to show the server position
	this.show_dest_pos = false;		 //Whether or not to show the interpolation goal
	this.client_predict = true;		 //Whether or not the client is predicting input
	this.input_seq = 0;				 //When predicting client inputs, we store the last input as a sequence number
	this.client_smoothing = true;	   //Whether or not the client side prediction tries to smooth things out
	this.client_smooth = 25;			//amount of smoothing to apply to client update dest

	this.net_latency = 0.001;		   //the latency between the client and the server (ping/2)
	this.net_ping = 0.001;			  //The round trip time from here to the server,and back
	this.last_ping_time = 0.001;		//The time we last sent a ping
	this.fake_lag = 0;				//If we are simulating lag, this applies only to the input client (not others)
	this.fake_lag_time = 0;

	this.net_offset = 100;			  //100 ms latency between server and client interpolation for other clients
	this.buffer_size = 2;			   //The size of the server history to keep for rewinding/interpolating.
	this.target_time = 0.01;			//the time where we want to be in the server timeline
	this.oldest_tick = 0.01;			//the last time tick we have available in the buffer

	this.client_time = 0.01;			//Our local 'clock' based on server time - client interpolation(net_offset).
	this.server_time = 0.01;			//The time the server reported it was at, last we heard from it
	
	this.dt = 0.016;					//The time that the last frame took to run
	this.fps = 0;					   //The current instantaneous fps (1/this.dt)
	this.fps_avg_count = 0;			 //The number of samples we have taken for fps_avg
	this.fps_avg = 0;				   //The current average fps displayed in the debug UI
	this.fps_avg_acc = 0;			   //The accumulation of the last avgcount fps samples
	
	this.ready=false;
	this.lit = 0;
	this.llt = new Date().getTime();

};//game_core.client_create_configuration

game_core.prototype.client_reset_positions = function() {
	if(this.played)return ;
	this.played=true;
	this.bullets=[]
	this.players.self.health=100
	this.players.self.max_health=100	
	this.players.other.health=100
	this.players.other.max_health=100	
	document.getElementById("chat_output").innerHTML=''

	var player_host = this.players.self.host ?  this.players.self : this.players.other;
	var player_client = this.players.self.host ?  this.players.other : this.players.self;

		//Host always spawns at the top left.
	player_host.pos = { x:200,y:200 };
	player_client.pos = { x:500, y:200 };

		//Make sure the local player physics is updated
	this.players.self.old_state.pos = this.pos(this.players.self.pos);
	this.players.self.pos = this.pos(this.players.self.pos);
	this.players.self.cur_state.pos = this.pos(this.players.self.pos);

		//Position all debug view items to their owners position
	this.ghosts.server_pos_self.pos = this.pos(this.players.self.pos);

	this.ghosts.server_pos_other.pos = this.pos(this.players.other.pos);
	this.ghosts.pos_other.pos = this.pos(this.players.other.pos);

}; //game_core.client_reset_positions

game_core.prototype.client_onreadygame = function(data) {
	this.ready=true;
	document.getElementById("chat_output").innerHTML='';
	
	data=data.split('.')
	data.splice(0,2)
	data=data.join('.').split('@')
	//sets map properties
	this.world.width=maps[data[1]].width*48
	this.world.height=maps[data[1]].height*48
	
	this.players.self.pos_limits.x_max=this.world.width
	this.players.self.pos_limits.y_max=this.world.height
	
	this.players.other.pos_limits.x_max=this.world.width
	this.players.other.pos_limits.y_max=this.world.height
	this.mapIndex=data[1]*1
	
	//moves player to starting position
	this.players.self.pos={x:data[2]*1,y:data[3]*1}

	this.players.self.old_state.pos = this.pos(this.players.self.pos);
	this.players.self.pos = this.pos(this.players.self.pos);
	this.players.self.cur_state.pos = this.pos(this.players.self.pos);
	
	this.world.x=data[2]*1-this.viewport.width/2
	this.world.y=data[3]*1-this.viewport.height/2
	
	var server_time = parseFloat(data[0]);
	
	var player_host = this.players.self.host ?  this.players.self : this.players.other;
	var player_client = this.players.self.host ?  this.players.other : this.players.self;

	this.players.self.info_color = '#cc8822';
	this.players.other.info_color = '#2288cc';
	this.local_time = server_time + this.net_latency;
	//console.log('server time is about ' + this.local_time);

	this.players.self.state = this.name+' (YOU)';

	//set name
	this.socket.send('n.' + this.name);
	
	play_music.play();
	
	document.getElementById('map_name').textContent=maps[this.mapIndex].name
}; //client_onreadygame

game_core.prototype.client_onjoingame = function(data) {

		//We are not the host
	this.players.self.host = false;
		//Update the local state
	this.players.self.state = 'connected.joined.waiting';
	this.players.self.info_color = '#00bb00';

		//Make sure the positions match servers and other clients
	this.client_reset_positions();
	document.getElementById('map_name').innerContent='???????'

}; //client_onjoingame

game_core.prototype.client_onhostgame = function(data) {

		//The server sends the time when asking us to host, but it should be a new game.
		//so the value will be really small anyway (15 or 16ms)
	var server_time = parseFloat(data.replace('-','.'));

		//Get an estimate of the current time on the server
	this.local_time = server_time + this.net_latency;

		//Set the flag that we are hosting, this helps us position respawns correctly
	this.players.self.host = true;

		//Update debugging information to display state
	this.players.self.state = 'hosting.waiting for a player';
	this.players.self.info_color = '#cc0000';

		//Make sure we start in the correct place as the host.
	this.client_reset_positions();

}; //client_onhostgame

game_core.prototype.client_onconnected = function(data) {

		//The server responded that we are now in a game,
		//this lets us store the information about ourselves and set the colors
		//to show we are now ready to be playing.
	this.players.self.id = data.id;
	this.players.self.info_color = '#cc0000';
	this.players.self.state = 'connected';
	this.players.self.online = true;

}; //client_onconnected

game_core.prototype.client_onping = function(data) {

	this.net_ping = new Date().getTime() - parseFloat( data );
	this.net_latency = this.net_ping/2;

}; //client_onping

game_core.prototype.client_onnetmessage = function(data) {

	var commands = data.split('.');
	var command = commands[0];
	var subcommand = commands[1] || null;
	var commanddata = commands[2] || null;

	switch(command) {
		case 's': //server message

			switch(subcommand) {

				case 'h' : //host a game requested
					this.client_onhostgame(commanddata);
				break;
				
				case 'j' : //join a game requested
					this.client_onjoingame(commanddata);
				break;
				
				case 'r' : //ready a game requested
					this.client_onreadygame(data);
				break;
				
				case 'e' : //end game requested
					this.client_ondisconnect(commanddata);
				break;
				
				case 'p' : //server ping
					this.client_onping(commanddata);
				break;
				
				case 'c' : //other player changed colors
					data=data.split('.')
					data.splice(0,2)
					data=data.join('.')
					display_message(data)
				break;
				case 'a' ://set angle
					data=data.split('.')
					data.splice(0,2)
					data=data.join('.')

					this.players.other.angle=data*1
				break;
				case 'b'://fires bullet
					data=data.split('.')
					data.splice(0,2)
					data=data.join('.').split('@')				
					this.bullets.push({
						x:data[0]*1,
						y:data[1]*1,
						angle:data[2]*1,
						ID:data[3],
						safe:data[4]==this.players.self.host
					})
					
					var sound=new Audio(sounds['laser'])
					sound.volume=sfx_volume*0.33;
					sound.play()
				break;
				case 'n': //sets name of other player
					data=data.split('.')
					data.splice(0,2)
					this.players.other.state=data.join('.')+' (OPPONENT)'
				break;
				case 'd'://deletes bullets
					data=data.split('.')
					data.splice(0,2)
					data=data.join('.')
					for(var i in this.bullets){
						if(this.bullets[i].ID==data*1){
							this.bullets.splice(i,1);
							break;
						}
					}
				break;
				case 'm':
					data=data.split('.')
					data.splice(0,2)
					data=data.join('.').split('@')
					for(var i in this.bullets){
						if(this.bullets[i].ID==data[0]*1){
							this.bullets[i].safe=data[1]==this.players.self.host
							this.bullets[i].x=data[2]*1
							this.bullets[i].y=data[3]*1
							this.bullets[i].angle=data[4]*1
							break;
						}
					}	
				break;
				case 'k'://set health
					data=data.split('.')
					data.splice(0,2)
					data=data.join('.').split('@')
					if(this.players.self.host==data[0]){
						this.players.self.health=data[1]*1
					}else{
						this.players.other.health=data[1]*1
					}
				break;
				
				case 'i'://pickups
					data=data.split('.')
					data.splice(0,2)
					var message=data.join('.').split('@')
					if(message[0]=='c'){
						//creates pickup
						this.pickups.push({
							ID:message[1],
							x:message[2]*1,
							y:message[3]*1,
							type:message[4]
						})
					}else{
						//delete pickups
						for(var i=0;i<this.pickups.length;i++){
							
							if(this.pickups[i].ID==message[2]){

								if(this.pickups[i].type=='shield'){
									if(message[1]==this.players.self.host)
										this.players.self.shieldProtection=new Date()
									else 
										this.players.other.shieldProtection=new Date()
								}
								(function(game,i){
									setTimeout(function(){
										game.pickups.splice(i,1)
									},100)
								})(this,i)
								var sound=new Audio(sounds['pickup'])
								sound.volume=sfx_volume*0.33;
								sound.play()

								break;
							}
						}
					}
				break;
			} //subcommand

		break; //'s'
	} //command
				
}; //client_onnetmessage

game_core.prototype.client_ondisconnect = function(data) {
	play_music.pause()
	play_music.currentTime=0
	document.getElementById('game_room').style.display='none';
	document.getElementById('game_over').style.display='block';
	document.getElementById('revive').onclick=startGame
	cancelAnimationFrame(this.updateid);
	var message='DRAW!!!'
	
	if(this.players.other.health<=0)message='YOU WIN!!!'
	if(this.players.self.health<=0)message='YOU LOSE!!!'
	document.getElementById('restart_title').innerHTML=message
	game={}
}; //client_ondisconnect

game_core.prototype.client_connect_to_server = function() {
		
			//Store a local reference to our connection to the server
		//this.socket = io.connect();
		this.socket = io.connect(null,{'force new connection':true,'reconnect': false});
			//When we connect, we are not 'connected' until we have a server id
			//and are placed in a game by the server. The server sends us a message for that.
		this.socket.on('connect', function(){
		
		}.bind(this));

			//Sent when we are disconnected (network, server down, etc)
		this.socket.on('disconnect', this.client_ondisconnect.bind(this));
			//Sent each tick of the server simulation. This is our authoritive update
		this.socket.on('onserverupdate', this.client_onserverupdate_recieved.bind(this));
			//Handle when we connect to the server, showing state and storing id's.
		this.socket.on('onconnected', this.client_onconnected.bind(this));
			//On error we just show that we are not connected for now. Can print the data.
		this.socket.on('error', this.client_ondisconnect.bind(this));
			//On message from the server, we parse the commands and send it to the handlers
		this.socket.on('message', this.client_onnetmessage.bind(this));

}; //game_core.client_connect_to_server

game_core.prototype.client_refresh_fps = function() {

		//We store the fps for 10 frames, by adding it to this accumulator
	this.fps = 1/this.dt;
	this.fps_avg_acc += this.fps;
	this.fps_avg_count++;

		//When we reach 10 frames we work out the average fps
	if(this.fps_avg_count >= 10) {

		this.fps_avg = this.fps_avg_acc/10;
		this.fps_avg_count = 1;
		this.fps_avg_acc = this.fps;

	} //reached 10 frames

}; //game_core.client_refresh_fps


