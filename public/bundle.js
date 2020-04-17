var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, changed, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(changed, child_ctx);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
                return ret;
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /* Article.svelte generated by Svelte v3.12.1 */

    const file = "Article.svelte";

    function create_fragment(ctx) {
    	var div1, div0, t0_value = new Date(ctx.article.publishedAt).toLocaleDateString('en-NZ') + "", t0, t1, t2_value = ctx.article.description + "", t2, t3_value = ' ' + "", t3, t4, a, t5, a_href_value;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = text(": ");
    			t2 = text(t2_value);
    			t3 = text(t3_value);
    			t4 = space();
    			a = element("a");
    			t5 = text("Click or tap to read story");
    			attr_dev(a, "href", a_href_value = ctx.article.url);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "rel", "noopener noreferrer");
    			attr_dev(a, "class", "svelte-8icsyf");
    			add_location(a, file, 36, 4, 733);
    			attr_dev(div0, "class", "svelte-8icsyf");
    			add_location(div0, file, 34, 2, 631);
    			attr_dev(div1, "class", "article svelte-8icsyf");
    			add_location(div1, file, 33, 0, 607);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, t2);
    			append_dev(div0, t3);
    			append_dev(div0, t4);
    			append_dev(div0, a);
    			append_dev(a, t5);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.article) && t0_value !== (t0_value = new Date(ctx.article.publishedAt).toLocaleDateString('en-NZ') + "")) {
    				set_data_dev(t0, t0_value);
    			}

    			if ((changed.article) && t2_value !== (t2_value = ctx.article.description + "")) {
    				set_data_dev(t2, t2_value);
    			}

    			if ((changed.article) && a_href_value !== (a_href_value = ctx.article.url)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div1);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { article } = $$props;

    	const writable_props = ['article'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Article> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('article' in $$props) $$invalidate('article', article = $$props.article);
    	};

    	$$self.$capture_state = () => {
    		return { article };
    	};

    	$$self.$inject_state = $$props => {
    		if ('article' in $$props) $$invalidate('article', article = $$props.article);
    	};

    	return { article };
    }

    class Article extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, ["article"]);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Article", options, id: create_fragment.name });

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.article === undefined && !('article' in props)) {
    			console.warn("<Article> was created without expected prop 'article'");
    		}
    	}

    	get article() {
    		throw new Error("<Article>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set article(value) {
    		throw new Error("<Article>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const feeds = {
      "New Zealand": `https://newsapi.org/v2/top-headlines?country=nz&apiKey=`,
      Australia: `https://newsapi.org/v2/top-headlines?country=au&apiKey=`,
      UK: `https://newsapi.org/v2/top-headlines?country=gb&apiKey=`,
      USA: `https://newsapi.org/v2/top-headlines?country=us&apiKey=`,
      BBC: `https://newsapi.org/v2/top-headlines?sources=bbc-news&apiKey=`,
      Singapore: `https://newsapi.org/v2/top-headlines?country=sg&apiKey=`,
      Reuters: `https://newsapi.org/v2/top-headlines?sources=reuters&apiKey=`,
      "National Geographic": `https://newsapi.org/v2/top-headlines?sources=national-geographic&apiKey=`,
    };

    const apiKey = "027fe0ba771349fa87775b60c62ba426";

    /* App.svelte generated by Svelte v3.12.1 */

    const file$1 = "App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.article = list[i];
    	return child_ctx;
    }

    // (166:28) 
    function create_if_block_2(ctx) {
    	var h2, t;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			t = text(ctx.feedName);
    			attr_dev(h2, "class", "svelte-14q7xrp");
    			add_location(h2, file$1, 166, 4, 3453);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t);
    		},

    		p: function update(changed, ctx) {
    			if (changed.feedName) {
    				set_data_dev(t, ctx.feedName);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(h2);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_2.name, type: "if", source: "(166:28) ", ctx });
    	return block;
    }

    // (164:2) {#if loading}
    function create_if_block_1(ctx) {
    	var p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Loading...";
    			attr_dev(p, "class", "loading svelte-14q7xrp");
    			add_location(p, file$1, 164, 4, 3386);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(p);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_1.name, type: "if", source: "(164:2) {#if loading}", ctx });
    	return block;
    }

    // (170:2) {#if articles !== null}
    function create_if_block(ctx) {
    	var each_blocks = [], each_1_lookup = new Map(), t, div, a, current;

    	let each_value = ctx.articles;

    	const get_key = ctx => ctx.article.title;

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			div = element("div");
    			a = element("a");
    			a.textContent = "Back to Top";
    			attr_dev(a, "class", "back-to-top-link svelte-14q7xrp");
    			attr_dev(a, "href", "#top");
    			add_location(a, file$1, 174, 6, 3647);
    			attr_dev(div, "class", "back-to-top-link-container svelte-14q7xrp");
    			add_location(div, file$1, 173, 4, 3600);
    		},

    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, t, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, a);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			const each_value = ctx.articles;

    			group_outros();
    			each_blocks = update_keyed_each(each_blocks, changed, get_key, 1, ctx, each_value, each_1_lookup, t.parentNode, outro_and_destroy_block, create_each_block, t, get_each_context);
    			check_outros();
    		},

    		i: function intro(local) {
    			if (current) return;
    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},

    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},

    		d: function destroy(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) {
    				detach_dev(t);
    				detach_dev(div);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block.name, type: "if", source: "(170:2) {#if articles !== null}", ctx });
    	return block;
    }

    // (171:4) {#each articles as article (article.title)}
    function create_each_block(key_1, ctx) {
    	var first, current;

    	var article = new Article({
    		props: { article: ctx.article },
    		$$inline: true
    	});

    	const block = {
    		key: key_1,

    		first: null,

    		c: function create() {
    			first = empty();
    			article.$$.fragment.c();
    			this.first = first;
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(article, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var article_changes = {};
    			if (changed.articles) article_changes.article = ctx.article;
    			article.$set(article_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(article.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(article.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(first);
    			}

    			destroy_component(article, detaching);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block.name, type: "each", source: "(171:4) {#each articles as article (article.title)}", ctx });
    	return block;
    }

    function create_fragment$1(ctx) {
    	var header, h1, t1, main, div, label, select, option0, option1, option2, option3, option4, option5, option6, option7, option8, t11, t12, t13, footer, a, current, dispose;

    	function select_block_type(changed, ctx) {
    		if (ctx.loading) return create_if_block_1;
    		if (ctx.feedName !== '') return create_if_block_2;
    	}

    	var current_block_type = select_block_type(null, ctx);
    	var if_block0 = current_block_type && current_block_type(ctx);

    	var if_block1 = (ctx.articles !== null) && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			header = element("header");
    			h1 = element("h1");
    			h1.textContent = "News Feeds";
    			t1 = space();
    			main = element("main");
    			div = element("div");
    			label = element("label");
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Select a Feed";
    			option1 = element("option");
    			option1.textContent = "New Zealand";
    			option2 = element("option");
    			option2.textContent = "Australia";
    			option3 = element("option");
    			option3.textContent = "UK";
    			option4 = element("option");
    			option4.textContent = "USA";
    			option5 = element("option");
    			option5.textContent = "BBC";
    			option6 = element("option");
    			option6.textContent = "Singapore";
    			option7 = element("option");
    			option7.textContent = "Reuters";
    			option8 = element("option");
    			option8.textContent = "National Geographic";
    			t11 = space();
    			if (if_block0) if_block0.c();
    			t12 = space();
    			if (if_block1) if_block1.c();
    			t13 = space();
    			footer = element("footer");
    			a = element("a");
    			a.textContent = "Powered by NewsAPI.org";
    			attr_dev(h1, "id", "top");
    			attr_dev(h1, "class", "svelte-14q7xrp");
    			add_location(h1, file$1, 143, 2, 2683);
    			attr_dev(header, "class", "svelte-14q7xrp");
    			add_location(header, file$1, 142, 0, 2672);
    			option0.__value = "Message";
    			option0.value = option0.__value;
    			add_location(option0, file$1, 150, 8, 2874);
    			option1.__value = "New Zealand";
    			option1.value = option1.__value;
    			add_location(option1, file$1, 151, 8, 2929);
    			option2.__value = "Australia";
    			option2.value = option2.__value;
    			add_location(option2, file$1, 152, 8, 2986);
    			option3.__value = "UK";
    			option3.value = option3.__value;
    			add_location(option3, file$1, 153, 8, 3039);
    			option4.__value = "USA";
    			option4.value = option4.__value;
    			add_location(option4, file$1, 154, 8, 3078);
    			option5.__value = "BBC";
    			option5.value = option5.__value;
    			add_location(option5, file$1, 155, 8, 3119);
    			option6.__value = "Singapore";
    			option6.value = option6.__value;
    			add_location(option6, file$1, 156, 8, 3160);
    			option7.__value = "Reuters";
    			option7.value = option7.__value;
    			add_location(option7, file$1, 157, 8, 3213);
    			option8.__value = "National Geographic";
    			option8.value = option8.__value;
    			add_location(option8, file$1, 158, 8, 3262);
    			attr_dev(select, "id", "feeds");
    			select.value = "Message";
    			attr_dev(select, "class", "svelte-14q7xrp");
    			add_location(select, file$1, 149, 6, 2807);
    			attr_dev(label, "for", "feeds");
    			add_location(label, file$1, 148, 4, 2781);
    			attr_dev(div, "class", "select-style svelte-14q7xrp");
    			add_location(div, file$1, 147, 2, 2750);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "href", "https://newsapi.org/");
    			attr_dev(a, "rel", "noopener noreferrer");
    			attr_dev(a, "class", "svelte-14q7xrp");
    			add_location(a, file$1, 179, 4, 3738);
    			attr_dev(footer, "class", "svelte-14q7xrp");
    			add_location(footer, file$1, 178, 2, 3725);
    			attr_dev(main, "class", "container svelte-14q7xrp");
    			add_location(main, file$1, 145, 0, 2722);
    			dispose = listen_dev(select, "change", ctx.changeFeed);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, h1);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, label);
    			append_dev(label, select);
    			append_dev(select, option0);
    			append_dev(select, option1);
    			append_dev(select, option2);
    			append_dev(select, option3);
    			append_dev(select, option4);
    			append_dev(select, option5);
    			append_dev(select, option6);
    			append_dev(select, option7);
    			append_dev(select, option8);
    			append_dev(main, t11);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t12);
    			if (if_block1) if_block1.m(main, null);
    			append_dev(main, t13);
    			append_dev(main, footer);
    			append_dev(footer, a);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (current_block_type === (current_block_type = select_block_type(changed, ctx)) && if_block0) {
    				if_block0.p(changed, ctx);
    			} else {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);
    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(main, t12);
    				}
    			}

    			if (ctx.articles !== null) {
    				if (if_block1) {
    					if_block1.p(changed, ctx);
    					transition_in(if_block1, 1);
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(main, t13);
    				}
    			} else if (if_block1) {
    				group_outros();
    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});
    				check_outros();
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block1);
    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(if_block1);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(header);
    				detach_dev(t1);
    				detach_dev(main);
    			}

    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			dispose();
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$1.name, type: "component", source: "", ctx });
    	return block;
    }

    let favouriteSet = false;

    function instance$1($$self, $$props, $$invalidate) {
    	

      let loading = false;
      let feedName = "";
      let articles = null;

      onMount(() => {
        const favourite = window.localStorage.getItem("favourite");
        if (favourite) {
          $$invalidate('feedName', feedName = favourite);
          const feedURL = feeds[favourite];
          fetchFeedData(feedURL);
        }
      });

      function fetchFeedData(url) {
        $$invalidate('loading', loading = true);
        fetch(`${url}${apiKey}`)
          .then(response => response.json())
          .then(data => {
            $$invalidate('loading', loading = false);
            $$invalidate('articles', articles = data.articles);
          })
          .catch(err => console.log(err));
      }

      function changeFeed(evt) {
        evt.preventDefault();
        const feedURL = feeds[evt.target.value];
        $$invalidate('feedName', feedName = evt.target.value);
        fetchFeedData(feedURL);
        window.localStorage.setItem("favourite", feedName);
      }

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ('loading' in $$props) $$invalidate('loading', loading = $$props.loading);
    		if ('feedName' in $$props) $$invalidate('feedName', feedName = $$props.feedName);
    		if ('articles' in $$props) $$invalidate('articles', articles = $$props.articles);
    		if ('favouriteSet' in $$props) favouriteSet = $$props.favouriteSet;
    	};

    	return { loading, feedName, articles, changeFeed };
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "App", options, id: create_fragment$1.name });
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
