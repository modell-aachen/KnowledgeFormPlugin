jQuery(function($){
    var tagcloud = foswiki.getPreference("SCRIPTURLPATH") + '/rest' + foswiki.getPreference("SCRIPTSUFFIX") + '/KnowledgeFormPlugin/tagcloud';
    var autocomplete = foswiki.getPreference("SCRIPTURLPATH") + '/rest' + foswiki.getPreference("SCRIPTSUFFIX") + '/KnowledgeFormPlugin/autocomplete';

    // workaround for select2 not losing focus
    var focusLoose=function(ev){
        if(!ev) return;
        var target=ev.target;
        if(!target) return;
        var targetName=ev.target.name;
        if(!targetName) {
            var $target = $(target);
            if(!$target.hasClass('select2-input')) return;
            var $next = $target.closest('.select2-container').next();
            targetName = $next.attr('name');
            if(!targetName) return;

            // workaround for select2 not losing focus
            $('input.MetaFacet_select2:not([name="' + targetName + '"])').select2('close');
        }
        return true;
    };
    var focus = function(ev) {focusLoose(ev);focusCloud(ev);}
    // XXX hide cloud when switching to non-select2
    var focusCloud = function(ev){
        var $focused = $(this);

        var $container; // XXX seems there is no function to get to the select2?
        var target = $(ev.target).closest("div.select2-container").get(0);
        if (target) {
            $container = $(target);
        } else {
            $(document).find("div.select2-container-active").each(function () {
                if ($(this).data('select2').isFocused()) $container = $(this);
            });
        }
        if(!$container) {
            $container = $('div.select2-dropdown-open:first');
        }

        $('div.MetaFacets_Facets>div').hide();
        if(!$container) return;
        var targetName = $container.next().attr('name');

        if(!targetName) return;
        $('.facetView>div.lrFacets>div').hide();
        var $facetDiv = $('.facetView>div.lrFacets>div.lrFacet_'+targetName);
        showCloud($facetDiv);
        return true;
    };

    var createOptions = function(field, searchin, req) {
        var options = {
            webtopic:foswiki.getPreference('WEB')+'.'+foswiki.getPreference('TOPIC'),
            searchin: searchin || field,
            term: req.term.toLowerCase(), // XXX why does lowercasing in analyser not work!?!
            termOrig: req.term,
            field: field,
        };
        return options;
    };

    var filterData = function(data, term, addNew) {
        if(typeof(term) === 'undefined') return [];
        var filtered = [];
        var found = false;
        if(data) {
            var regexp = new RegExp(term, "i");
            var filter = function(key,val) {
                if(regexp.exec(val.value)) {
                    if(val.value === term) found = true;
                    filtered.push(val);
                }
            }
            $.each(data, filter);
        } else {
            window.console && console.log("no data");
        }
        if(!found && addNew && term.length) {
            filtered.push({label:term+' (neu)', value: term});
        }
        return filtered;
    };
    var filterAjax = function(o, resp, term) {
        jQuery.getJSON(url, o, function(data, stat, jqXHR){
            resp(filterData(data, undefined, o.addNew), stat, jqXHR);
        });
    };
    var initSelectionMultiple = function(element, callback) {
        var data = [];
        $(element.val().split(',')).each(function() {
            data.push({id: this, text: this});
        });
        callback(data);
    };
    var initSelectionSingle = function(element, callback) {
        var data = {id: element.val(), text: element.val()};
        callback(data);
    };
    var createSelect2Object = function($input, field, searchfield, formtopic, targetweb) {
        var savedTerm;
        var addNew = $input.hasClass('addNew');
        var multiple = $input.hasClass('lst');
        var createOptionsSelect2 = function(term, page) {
            savedTerm = term;
            var options = {
                addNew: addNew,
                formtopic: formtopic,
                searchin: searchfield || field,
                term: term.toLowerCase(), // XXX why does lowercasing in analyser not work!?!
                termOrig: term,
                field: field,
                targetweb: targetweb
            };

            if(!$input.hasClass('doNotFilter')) {
                var $form = $input.closest('form');
                $form.find('input').each(function() { // XXX do proper serialize
                    var $this = $(this);
                    var val = $this.val();
                    var name = $this.attr('name');
                    if(val && name) {
                        options[name] = val;
                    }
                });
            }

            return options;
        };

        var select2 = {
            width: '100%',
            ajax: {
                url: autocomplete,
                dataType: 'json',
                data: createOptionsSelect2,
                results: function(data,page) {
                    if(savedTerm!==undefined) {
                        data = filterData(data, savedTerm, addNew);
                        savedTerm = undefined;
                    } else {
                        window.console && console.log("No saved term");
                    }
                    var results = [];
                    var i;
                    for(i = 0; i < data.length; i++) {
                        results[i] = {id: data[i].value, text: data[i].label};
                    }
                    return {results: results};
                }
            },
        }
        if(multiple) {
            select2.initSelection = initSelectionMultiple;
            select2.multiple = multiple;
            select2.tags = [];
            select2.tokenSeparators = [","];
        } else {
            select2.initSelection = initSelectionSingle;
            select2.allowClear = true;
            select2.placeholder = ' ';
        }
        return select2;
    };
    var getClass = function(attr) {
        var m = /lrFacet_([a-zA-Z0-9]+)/.exec(attr);
        if(!m) return '';
        return m[1];
    };
    var getInputForCloud = function($cloud) {
        var target = getClass($cloud.attr('class'));
        return $("input[name='"+target+"']");
    };
    var markTagCloud = function($clouds) {
        $clouds.each(function() {
            var $cloud = $(this);
            var $input = getInputForCloud($cloud);
            if(!$input.length) return;
            var values = $input.select2('val');
            if(typeof values === 'string') {
                values = new Array(values);
            }
            $.each(values, function(idx, selected) {
                var check = function() {
                    var $this = $(this);
                    if($this.text() === selected) {
                        $this.addClass('selected');
                    }
                };
                $cloud.find('span.item').each(check);
            });
        });
    };
    var click = function(ev) {
        var $this = $(this);
        var $input = getInputForCloud($this.closest('div.tagCloud'));
        var text = $this.text().replace(/\.\.\.$/,'');
        if($input.hasClass('MetaFacet_select2')) {
            if(!$input.hasClass('singlevalue')) {
                text = $input.select2('val').concat(text);
            }
            $input.select2('val', text).change();
            return;
        }
        $input.val(text).change();
    };
    var showCloud = function($facetDiv){
        if(!$facetDiv.hasClass('tgInited')) {
                $facetDiv.addClass('tgInited');
                $facetDiv.find('span').addClass('item').click(click);
                markTagCloud($facetDiv);
        }
        $facetDiv.show();
    };
    var change = function(ev, ui){
        var $this = $(this);
        if($this.hasClass('doNotFilter')) {
            $('.lrFacets span.item.selected').removeClass('selected');
            markTagCloud($('.lrFacets .lrFacet_' + $this.attr('name')));
        } else {
            var $orig = $this.closest('form');
            var $ajaxForm = $orig.clone();
            var formtopic = encodeURIComponent($this.attr('data-form'));
            var targetweb = encodeURIComponent($this.attr('data-web'));
            $ajaxForm.attr('action', tagcloud);
            $ajaxForm.append('<input type="text" name="formtopic" value="'+formtopic+'" />');
            $ajaxForm.append('<input type="text" name="targetweb" value="'+targetweb+'" />');
            $('.lrFacets>div').html("<img src='"+foswiki.getPreference('PUBURLPATH')+'/'+foswiki.getPreference('SYSTEMWEB')+"/JQueryPlugin/images/spinner.gif' />");
            $ajaxForm.ajaxSubmit({
                cache: false,
                success: function(data) {
                    var visible=$(".lrFacets>div:visible").first().attr('class');
                    visible = getClass(visible);
                    var $data = $('<div>'+data+'</div>');
                    showCloud($data.find('.lrFacet_'+visible));
                    $('.lrFacets').replaceWith($data.find('.lrFacets'));
                }
            });
        }

        return true;
    };
    $("input.MetaFacet_select2").livequery(function(){
        var $this = $(this);

        // we need to make sure, there are no spaces in front of an item (or select2 won't be able to remove it)
        var val = $this.val();
        var unspaced = val.replace(/ *, */g, ',').replace(/^ +/, '').replace(/ +$/, '');
        if(unspaced !== val) $this.val(unspaced);

        var options = $this.metadata();
        var id = $this.attr('id');
        if(!id) {
            id = 'input' + foswiki.getUniqueID();
            $this.attr('id', id);
        }
        var field = 'field_' + $this.attr('name') + ($this.hasClass('lst')?'_lst':'_s');
        var search = $this.hasClass('search')?('field_' + $this.attr('name') + ($this.hasClass('lst')?'_lst_msearch_parts':'_search')):field;
        var formtopic = $this.attr('data-form');
        var targetweb = $this.attr('data-web');
        $this.select2(createSelect2Object($this, field, search, formtopic, targetweb)).on('change', change).addClass('autoclose').attr('inputid', id);
    });
    $("input.select2-input:not(.MetaFacetBound)").livequery(function(){$(this).addClass('MetaFacetBound').focus(focus)});
});


