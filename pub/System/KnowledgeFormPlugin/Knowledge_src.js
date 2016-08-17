jQuery(function($){
    var tagcloud = foswiki.getPreference("SCRIPTURLPATH") + '/rest' + foswiki.getPreference("SCRIPTSUFFIX") + '/KnowledgeFormPlugin/tagcloud';
    var autocomplete = foswiki.getPreference("SCRIPTURLPATH") + '/rest' + foswiki.getPreference("SCRIPTSUFFIX") + '/KnowledgeFormPlugin/autocomplete';

    // hides open clouds
    var closed = function(ev){
        $('.facetView>div.lrFacets>div').hide();
        return true;
    };

    // shows the correct cloud
    var focus = function(ev){
        var $this = $(this);

        $('.facetView>div.lrFacets>div').hide();
        var targetName = $this.attr('name');

        if(!targetName) return;
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
    var createSelect2Object = function($select, field, searchfield, formtopic, targetweb) {
        var savedTerm;
        var addNew = $select.hasClass('addNew');
        var multiple = $select.hasClass('lst');
        var createOptionsSelect2 = function(params) {
            var term = params.term || '';
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

            if(!$select.hasClass('doNotFilter')) {
                var $form = $select.closest('form');
                extendOptions(options, $form);
            }

            return options;
        };
        var val = $select.attr('data-value') || '';
        val = val.split(/,/).map(function(val){ return val.replace(/^\s+/, '').replace(/\s+$/, '');}).filter(function(val){ return val.length; });

        var select2 = {
            width: '100%',
            ajax: {
                url: autocomplete,
                dataType: 'json',
                data: createOptionsSelect2,
                processResults: function(data) {
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
            val: val,
            data: val.map(function(val){ return {id:val, text:val}; })
        }
        if(multiple) {
            $select.attr('multiple', true);
            select2.multiple = multiple;
            select2.tokenSeparators = [","];
        } else {
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
        return $("select[name='"+target+"']");
    };
    var markTagCloud = function($clouds) {
        $clouds.each(function() {
            var $cloud = $(this);
            var $input = getInputForCloud($cloud);
            if(!$input.length) return;
            var values = $input.val();
            if(values === null || values == undefined) return;
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
        var selection = [text];
        if($input.hasClass('MetaFacet_select2')) {
            if($input.prop('multiple')) {
                var val = $input.val();
                if(val) selection = selection.concat(val);
            }
            select($input, selection);
            return false;
        }
        $input.val(text).change();
    };
    var select = function($select, selection) {
        var i;
        for(i = 0; i < selection.length; i++) {
            if(!$select.find('option[value="' + selection[i].replace(/"/g, '\\"') + '"]').length) {
                $select.append($('<option></option>').val(selection[i]).text(selection[i]));
            }
        }
        $select.val(selection).change();
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
        if($this.closest('form').find('.doNotFilter').length) {
            $('.lrFacets span.item.selected').removeClass('selected');
            markTagCloud($('.lrFacets .lrFacet_' + $this.attr('name')));
        } else {
            var options = {
                formtopic: $this.attr('data-form'),
                targetweb: $this.attr('data-web')
            };

            var $form = $this.closest('form');
            extendOptions(options, $form);

            $('.lrFacets>div').html("<img src='"+foswiki.getPreference('PUBURLPATH')+'/'+foswiki.getPreference('SYSTEMWEB')+"/JQueryPlugin/images/spinner.gif' />");
            $.ajax({
                url: tagcloud,
                cache: false,
                data:options,
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
    var mandatoryGroupCheckAdded;
    var addMandatoryGroupCheck = function($select) {
        if (mandatoryGroupCheckAdded) return;
        mandatoryGroupCheckAdded = true;
        $($select).closest('form').submit(function(event) {
            event.preventDefault();
            var mandatory = $("[data-group][data-group!='']");
            // find all mandatory groups
            var groups = [];
            $.each(mandatory, function(i, field){
                var groupName = ''+$(field).attr("data-group");
                if(groups.indexOf(groupName) == -1) {
                    groups.push( groupName );
                }
            });
            // check if each group is filled out
            var isFilledOut = true;
            $.each(groups, function(i, group){
                var isGroupFilledOut = false;
                var groupFields = $("[data-group='"+ group +"']");
                var fields = []
                $.each(groupFields, function(i, field){
                    if($(field).val()) {
                        isGroupFilledOut = true;
                        return false;
                    }
                    var $form = $(field).closest('tr.modacForm');
                    fields.push($form.find('span.title').text());
                });
                if(!isGroupFilledOut) {
                    var alerts = [];
                    alerts.push(jsi18n.get('alert',"You have not filled out on of the mandatory fields: '[_1]'.", fields.join(", ")));
                    alerts.push(jsi18n.get('edit',"Please check your input."));
                    alert(alerts.join("\n"));
                    isFilledOut = false;
                    $.unblockUI();
                    return false;
                }
            });
            //submit form when mandatory groups filled out
            if(isFilledOut) {
                $(this).off('submit').trigger('submit');
            }
            return true;
        });
    };
    $("select.MetaFacet_select2").livequery(function(){
        var $this = $(this);

        var options = $this.metadata();
        var id = $this.attr('id');
        if(!id) {
            id = 'input' + foswiki.getUniqueID();
            $this.attr('id', id);
        }
        var field = 'field_' + $this.attr('name') + ($this.hasClass('lst')?'_lst':'_s');
        var search = $this.hasClass('search')?('field_' + $this.attr('name') + ($this.hasClass('lst')?'_lst_msearch':'_search')):field;
        var formtopic = $this.attr('data-form');
        var targetweb = $this.attr('data-web');
        if(!$this.prop('multiple') && !$this.find('option[value=""]').length) {
            $this.prepend('<option></option>');
        }
        var s2Options = createSelect2Object($this, field, search, formtopic, targetweb);
        var mandatoryGroup = $this.attr('data-group');
        if(mandatoryGroup){
            addMandatoryGroupCheck($this);
        }
        var s2 = $this.select2(s2Options);
        select($this, s2Options.val);
        $this.on('select2:opening', focus).on('select2:closed', closed).change(change);
    });
    $("input[name='q']").each(function(){
        var $input = $(this);
        var formtopic = $input.attr('data-form');
        var targetweb = $input.attr('data-web');
        $input.autocomplete({
            source: function(query, callback) {
                var savedTerm = query.term;
                var options = {
                    addNew: false,
                    formtopic: formtopic,
                    searchin: 'catchall',
                    term: query.term.toLowerCase(), // XXX why does lowercasing in analyser not work!?!
                    termOrig: query.term,
                    field: 'catchall',
                    targetweb: targetweb
                };

                var $form = $input.closest('form');
                extendOptions(options, $form);
                $.ajax({
                    url: autocomplete,
                    dataType: 'json',
                    data: options,
                    complete: function(jqXHR, textStatus) {
                        callback(jqXHR.responseJSON);
                    }
                });
            }
        });
    }).change(change);
});

var extendOptions = function(options, $form) {
    $form.find('input,select').each(function() {
        var $this = $(this);
        var val = $this.val();
        if(val && val.join) val = val.join(',');
        var name = $this.attr('name');
        if(val && name) {
            options[name] = val;
        }
    });
};
