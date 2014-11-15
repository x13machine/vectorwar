/*  Copyright (c) 2012 Sven "FuzzYspo0N" Bergström
	
	written by : http://underscorediscovery.com
	written for : http://buildnewgames.com/real-time-multiplayer/
	
	MIT Licensed.
*/

mouse={
	x:0,
	y:0
}
	//A window global for our game root variable.
var game = {};

//When loading, we store references to our
//drawing canvases, and initiate a game instance.

function startGame(){
	var name=document.getElementById('name').value
	if(!/^[a-zA-Z0-9]{3,}$/.test(name))return ;
	document.getElementById('game_login').style.display='none';
	document.getElementById('game_room').style.display='block';
	document.getElementById('game_over').style.display='none';
	//Create our game client instance.
	game = new game_core();
	game.name=name
		//Fetch the viewport
	game.viewport = document.getElementById('viewport');
		
		//Adjust their size
	game.viewport.width = game.world.width;
	game.viewport.height = game.world.height;
	
		//Fetch the rendering contexts
	game.ctx = game.viewport.getContext('2d');
	
		//Set the draw style for the font
	game.ctx.font = '11px "Helvetica"';
	
	//Finally, start the loop
	game.update( new Date().getTime() );
	game_input()
}
//window.onload=startGame


function getMousePos(canvas, evt) {
	var rect = canvas.getBoundingClientRect();
	return {
		x: evt.clientX - rect.left,
		y: evt.clientY - rect.top
	};
}

var button_left, button_right;
button_left = window.mie ? 1 : 0;
button_right = 2;


function game_input(){
	game.viewport.onmousedown=function(e){
		if(e.button == button_left)game.socket.send('m.d');
	}
	
	game.viewport.onmouseup=function(e){
		if(e.button == button_left)game.socket.send('m.u');
	}
	
	game.viewport.addEventListener('mousemove', function(evt) {
		mouse = getMousePos(game.viewport, evt);
		//console.log('Mouse position: ' + mousePos.x + ',' + mousePos.y);
	
	})
	
	setInterval(function(){
		try{
			angle=Math.PI/2-Math.atan2(mouse.y - (game.players.self.pos.y-game.world.y ), mouse.x - (game.players.self.pos.x-game.world.x));
			game.socket.send('a.' + angle );
		}catch(err){}
	},100)

}

document.getElementById('viewport').oncontextmenu = function (e) {
    e.preventDefault();
};

function display_message(text){
	var node=document.createElement("div");
	var textnode=document.createTextNode('Opponent: ');
	node.appendChild(textnode);
	document.getElementById("chat_output").appendChild(node);
	node.style.color='red'
	node.style.float='left'
	node.style.paddingRight='4px'
	var node=document.createElement("div");
	var textnode=document.createTextNode(text);
	node.appendChild(textnode);
	document.getElementById("chat_output").appendChild(node);
	var objDiv = document.getElementById("chat_output");
	objDiv.scrollTop = objDiv.scrollHeight;
}

function send_message(){
	
	var input=document.getElementById("chat_input")
	if(/\S/.test(input.value)){
		var node=document.createElement("div");
		var textnode=document.createTextNode('You: ');
		node.appendChild(textnode);
		document.getElementById("chat_output").appendChild(node);
		node.style.color='blue'
		node.style.float='left'
		node.style.paddingRight='4px'
		var node=document.createElement("div");
		var textnode=document.createTextNode(input.value);
		node.appendChild(textnode);
		document.getElementById("chat_output").appendChild(node);		
		game.socket.send('c.'+input.value)
		var objDiv = document.getElementById("chat_output");
		objDiv.scrollTop = objDiv.scrollHeight;
		document.getElementById('chat_input').readOnly = true;
		setTimeout(function(){
			document.getElementById('chat_input').readOnly = false;
		},1000)
	}
	input.value=''
}

document.getElementById('chat_input').onkeypress = function(e){
    if (!e) e = window.event;
    var keyCode = e.keyCode || e.which;
    if (keyCode == '13')send_message()
}

document.getElementById('send').onclick=send_message

document.getElementById('play').onclick=startGame

document.getElementById('name').onkeypress = function(e){
    if (!e) e = window.event;
    var keyCode = e.keyCode || e.which;
    if (keyCode == '13')startGame()
}

var sfx_volume=3
var music_volume=3
var sounds={
	'laser':'laser.ogg',
	'music':'shadow.ogg',
	'pickup':'pickup.ogg'
}

var imgs={
	'search':'searching.png',
	'vol0':'audio-volume-0.svg',
	'vol1':'audio-volume-1.svg',
	'vol2':'audio-volume-2.svg',
	'vol3':'audio-volume-3.svg',
	'blue-player':'blue-player.png',
	'red-player':'blue-player.png',

}
var play_music={}
var fileCount=0
var filesLoaded=0

function loadUpdate(){
	filesLoaded++
	var percent=filesLoaded/fileCount*100
	document.getElementById('load_bar').style.width=percent+'%'
	if(percent==100)loadDone()
}

var started=false;

function loadDone(){
	console.log('done')
	if(started)return ;
	started=true;
	document.getElementById('game_load').style.display='none'
	document.getElementById('game_login').style.display='block'
	play_music=new Audio(sounds['music'])
	play_music.addEventListener('ended', function() {
		this.currentTime = 0;
		this.play();
	}, false);
}
var appCache = window.applicationCache;
appCache.onnoupdate= loadDone
appCache.oncached= loadDone

for(var i in imgs){
	fileCount++;
	var img=new Image()
	img.src='imgs/'+imgs[i]

	img.onload=loadUpdate
	imgs[i]=img
	
}
for(var i in sounds){
	fileCount++;
	sounds[i]='sounds/'+sounds[i]
	var music=new Audio(sounds[i])
	music.addEventListener('loadeddata',loadUpdate,false)
}



document.getElementById('music_down').onclick=function(){
	music_volume-=1
	if(music_volume<0)music_volume=0
	play_music.volume=music_volume*(1/3)
	document.getElementById('music_volume').src='imgs/audio-volume-'+music_volume+'.svg'
}

document.getElementById('music_up').onclick=function(){
	music_volume+=1
	if(music_volume>3)music_volume=3
	play_music.volume=music_volume*(1/3)
	document.getElementById('music_volume').src='imgs/audio-volume-'+music_volume+'.svg'
}

document.getElementById('sfx_down').onclick=function(){
	sfx_volume-=1
	if(sfx_volume<0)sfx_volume=0
	document.getElementById('sfx_volume').src='imgs/audio-volume-'+sfx_volume+'.svg'
}

document.getElementById('sfx_up').onclick=function(){
	sfx_volume+=1
	if(sfx_volume>3)sfx_volume=3
	document.getElementById('sfx_volume').src='imgs/audio-volume-'+sfx_volume+'.svg'
}
