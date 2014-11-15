function drawLine(ctx,p0,p1,color){
	ctx.beginPath();
	ctx.moveTo(p0[0],p0[1]);
	ctx.lineTo(p1[0],p1[1]);
	ctx.strokeStyle = color;
	ctx.stroke();
}

function vect(ctx,x,y,angle,color){
	var r=13
	p0=[x+Math.sin(angle)*3*r,y+Math.cos(angle)*3*r]
	p1=[x+-Math.sin(angle+Math.PI/6)*4*r,y+-Math.cos(angle+Math.PI/6)*4*r]
	p2=[x+-Math.sin(angle)*2*r,y+-Math.cos(angle)*2*r]
	
	p3=[x+-Math.sin(angle-Math.PI/6)*4*r,y+-Math.cos(angle-Math.PI/6)*4*r]
	
	ctx.lineWidth = 3;
	ctx.shadowBlur = 40;
	ctx.shadowColor = color
	drawLine(ctx,p0,p1,color);
	drawLine(ctx,p1,p2,color);
	drawLine(ctx,p2,p3,color);
	drawLine(ctx,p3,p0,color);
}

var pickups={
	health:function(ctx,x,y){
		x+=24
		y+=24
		ctx.beginPath();
		ctx.arc(x, y, 20, 0, 2 * Math.PI, false);
		ctx.shadowColor = 'red'
		ctx.shadowBlur = 10;
		ctx.lineWidth = 2;
		ctx.strokeStyle = 'red';
		ctx.stroke();
		
		ctx.shadowColor = 'white'
		ctx.shadowBlur = 10;
		ctx.lineWidth = 2;
		ctx.strokeStyle = 'white';
		ctx.beginPath();
		var z=8
		x-=4
		y-=12
		ctx.moveTo(x, y);
		x+=z
		ctx.lineTo(x,y);
		y+=z
		ctx.lineTo(x,y);
		x+=z
		ctx.lineTo(x,y);
		y+=z
		ctx.lineTo(x,y);
		x-=z
		ctx.lineTo(x,y);
		y+=z
		ctx.lineTo(x,y);
		x-=z
		ctx.lineTo(x,y);
		y-=z
		ctx.lineTo(x,y);
		x-=z
		ctx.lineTo(x,y);
		y-=z
		ctx.lineTo(x,y);
		x+=z
		ctx.lineTo(x,y);
		y-=z+1
		ctx.lineTo(x,y);
		ctx.stroke();
	},
	'shield':function(ctx,x,y){
		ctx.beginPath();
		ctx.moveTo(x+40, y+10);
		ctx.quadraticCurveTo(x+40,y+24,x+24, y+40);
		ctx.quadraticCurveTo(x+8,y+24,x+8,y+10);
		ctx.quadraticCurveTo(x+24,y+15,x+40,y+10);
		ctx.lineWidth = 2;
		ctx.strokeStyle = 'blue';
		ctx.shadowBlur = 10;
		ctx.shadowColor = 'blue'
		ctx.stroke();
	}
}
function roundRect(ctx, x, y, width, height, radius) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
	ctx.stroke();
     
}

function displayLayer(ctx,x,y,layer){
	//console.log(layer)
	if(!layer.visible)return ;
	data=layer.data
	var size=48
	for(i=0;i<data.length;i++){
		var s_x =((i % layer.width) * (size))+x;
		var s_y =( ~~(i / layer.width) * (size))+y;
		if(s_x>-64 && s_y>-64 &&s_x<game.viewport.width+64 && s_y<game.viewport.height+64 && render[data[i]-1])
			render[data[i]-1](ctx,s_x, s_y)
	}
}

var render={
	out:5,
	0:function(ctx,x,y){
		ctx.strokeStyle='aqua'
		ctx.lineWidth=2;
		ctx.shadowColor = 'aqua'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	1:function(ctx,x,y){
		ctx.strokeStyle='black'
		ctx.lineWidth=2;
		ctx.shadowColor = 'black'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	2:function(ctx,x,y){
		ctx.strokeStyle='blue'
		ctx.lineWidth=2;
		ctx.shadowColor = 'blue'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	3:function(ctx,x,y){
		ctx.strokeStyle='fuchsia'
		ctx.lineWidth=2;
		ctx.shadowColor = 'fuchsia'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	4:function(ctx,x,y){
		ctx.strokeStyle='gray'
		ctx.lineWidth=2;
		ctx.shadowColor = 'gray'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	5:function(ctx,x,y){
		ctx.strokeStyle='green'
		ctx.lineWidth=2;
		ctx.shadowColor = 'green'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	6:function(ctx,x,y){
		ctx.strokeStyle='lime'
		ctx.lineWidth=2;
		ctx.shadowColor = 'lime'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	7:function(ctx,x,y){
		ctx.strokeStyle='maroon'
		ctx.lineWidth=2;
		ctx.shadowColor = 'maroon'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	8:function(ctx,x,y){
		ctx.strokeStyle='navy'
		ctx.lineWidth=2;
		ctx.shadowColor = 'navy'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	9:function(ctx,x,y){
		ctx.strokeStyle='olive'
		ctx.lineWidth=2;
		ctx.shadowColor = 'olive'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	10:function(ctx,x,y){
		ctx.strokeStyle='orange'
		ctx.lineWidth=2;
		ctx.shadowColor = 'orange'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	11:function(ctx,x,y){
		ctx.strokeStyle='purple'
		ctx.lineWidth=2;
		ctx.shadowColor = 'purple'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	12:function(ctx,x,y){
		ctx.strokeStyle='red'
		ctx.lineWidth=2;
		ctx.shadowColor = 'red'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	13:function(ctx,x,y){
		ctx.strokeStyle='silver'
		ctx.lineWidth=2;
		ctx.shadowColor = 'silver'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	14:function(ctx,x,y){
		ctx.strokeStyle='teal'
		ctx.lineWidth=2;
		ctx.shadowColor = 'teal'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	15:function(ctx,x,y){
		ctx.strokeStyle='white'
		ctx.lineWidth=2;
		ctx.shadowColor = 'white'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	},
	16:function(ctx,x,y){
		ctx.strokeStyle='yellow'
		ctx.lineWidth=2;
		ctx.shadowColor = 'yellow'
		ctx.shadowBlur = 10;
		roundRect(ctx,x+this.out,y+this.out,48-this.out*2,48-this.out*2,5)
	}
}
