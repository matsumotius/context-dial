$(function(){
    var default_options = {
        context : { x : 0, y : 0, radius : 30, color : 'gray', type : 'stroke' },
        context_wheel : { x : 160, y :160, radius : 160, color : 'gray', type : 'stroke' }
    };
    var Context = function(_parent, _key, _options){
        this.__parent = _parent;
        this.key = _key;
        this.value = _options.value || 0;
        this.value_by_rot = _options.value_by_rot;
        this.max = _options.max;
        this.min = _options.min;
        this.__defineGetter__('is_max', function(){ return this.value >= this.max; });
        this.__defineGetter__('is_min', function(){ return this.value <= this.min; });
        this.radius = _options.radius;
        var en_options = $.extend(default_options.context, _options.en);
        this.en = $(this.__parent.target).en(en_options);
        this.en.on_rail(this.__parent.rail);
        this.is_drugging = false;
    };
    Context.prototype.set_event = function(){
        var that = this;
        var mousedown = this.en.is_smartphone ? 'touchstart' : 'mousedown';
        var mouseup = this.en.is_smartphone ? 'touchend' : 'mouseup';
        this.en.on(mousedown, function(e){
            that.is_drugging = true;
            that.__parent.fire('touchstart', that);
        });
        this.en.on(mouseup, function(e){
            that.is_drugging = false;
            that.__parent.fire('touchend', that);
        });
    };
    Context.prototype.adjust_value = function(){
        if(this.is_max) this.value = this.max;
        if(this.is_min) this.value = this.min;
    };
    var hash_length = function(hash){
        c = 0; for(var key in hash){ c++; } return c; 
    };
    var CD_EVENTS = ['change', 'touchstart', 'touchmove', 'touchend'];
    var ContextDial = function(_target, _options){
        this.target = _target;
        this.options = $.extend(default_options.context_wheel, _options);
        this.x = this.options.x;
        this.y = this.options.y;
        this.radius = this.options.radius;
        this.dial = $(this.target).en(this.options);
        this.rail = $(this.target).en({ 
            x : this.x, y : this.y, radius : this.radius * 0.6, color : this.options.color, type : 'fill'
        });
        this.count = 0;
        this.list = {};
        this.queue = [];
        this.events = {};
        for(var i=0;i<CD_EVENTS.length;i++) this.events[CD_EVENTS[i]] = [];
    };
    ContextDial.prototype.set_event = function(){
        var that = this;
        var mousemove = this.dial.is_smartphone ? 'touchmove' : 'mousemove';
        var mouseup = this.dial.is_smartphone ? 'touchend' : 'mouseup';
        // todo: move to other block
        this.dial.on(mousemove, function(e){
            that.count++;
            if(that.count % 3 != 0) return;
            that.coutn = 1;
            for(var key in that.list){
                var context = that.list[key];
                if(false === context.is_drugging) continue;
                var old_radian = that.rail.get_radian({ x : context.en.x, y : context.en.y });
                var new_radian = that.rail.get_radian({ x : e.pageX, y : e.pageY });
                var half_round = radian_from(180), round = radian_from(360);
                if(old_radian < 0) old_radian += round;
                if(new_radian < 0) new_radian += round;
                var radian_diff = old_radian - new_radian;
                if(old_radian >= half_round && new_radian < radian_from(90))  radian_diff -= round;
                if(old_radian <= half_round && new_radian > radian_from(270)) radian_diff += round;
                context.value += context.value_by_rot * radian_diff / RADIAN_BY_ROT;
                context.en.move(e.pageX, e.pageY);
                context.adjust_value();
                that.relocate_context(key);
                that.fire('touchmove', context);
                that.fire('change', context);
            }
        });
        this.dial.on(mouseup, function(e){
            for(var context in that.list) that.list[context].is_drugging = false;
        });
    };
    var radian_from = function(angle){
        return angle * Math.PI / 180;
    };
    var RADIAN_BY_ROT = radian_from(360);
    ContextDial.prototype.relocate_context = function(pivot){
        var length = hash_length(this.list);
        if(length <= 1) return;
        var context;
        var angle = 0;
        var angle_diff = 360 / length;
        var it_is_first = true;
        var pivot_index = this.queue.indexOf(pivot);
        if(pivot_index > 0) this.queue = this.queue.slice(pivot_index).concat(this.queue.slice(0, pivot_index));
        angle += this.rail.get_angle({ x : this.list[this.queue[0]].en.x, y : this.list[this.queue[0]].en.y });
        for(var i=1;i<this.queue.length;i++){
            context = this.list[this.queue[i]];
            angle += angle_diff;
            if(angle > 180) angle = -360 + angle;
            context.en.x = this.rail.x + this.rail.radius * Math.cos(radian_from(angle));
            context.en.y = this.rail.y - this.rail.radius * Math.sin(radian_from(angle));
            context.en.move(context.en.x, context.en.y);
        }
    };
    ContextDial.prototype.set_value = function(key, value){
        if(key in this.list) return;
        this.list[key].value = value;
    };
    ContextDial.prototype.add = function(key, options){
        var context = new Context(this, key, options);
        context.set_event();
        this.list[key] = context;
        this.queue.push(key);
        this.relocate_context();
    };
    ContextDial.prototype.on = function(ev, callback){
        if(ev in this.events) this.events[ev].push(callback);
    };
    ContextDial.prototype.fire = function(ev, context){
        if(false == (ev in this.events) || this.events[ev].length < 1) return;
        $.each(this.events[ev], function(index, callback){ callback(context); });
    };
    /*
    ContextDial.prototype.remove = function(key){
        if(false == (key in this.list)) return;
        this.list[key].en.remove();
        this.list[key] = null;
        var queue_index = this.queue.indexOf(key);
        this.queue = this.queue.slice(0, queue_index).concat(this.queue.slice(queue_index + 1));
    };
    */
    $.fn.context_dial = function(options){
        var context_dial = new ContextDial(this, options)
        context_dial.set_event();
        return context_dial;
    };
});
