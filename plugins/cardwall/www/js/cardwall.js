/**
  * Copyright (c) Enalean, 2013. All rights reserved
  *
  * This file is a part of Tuleap.
  *
  * Tuleap is free software; you can redistribute it and/or modify
  * it under the terms of the GNU General Public License as published by
  * the Free Software Foundation; either version 2 of the License, or
  * (at your option) any later version.
  *
  * Tuleap is distributed in the hope that it will be useful,
  * but WITHOUT ANY WARRANTY; without even the implied warranty of
  * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  * GNU General Public License for more details.
  *
  * You should have received a copy of the GNU General Public License
  * along with Tuleap. If not, see <http://www.gnu.org/licenses/
  */
var tuleap = tuleap || { };
tuleap.agiledashboard = tuleap.agiledashboard || { };
tuleap.agiledashboard.cardwall = tuleap.agiledashboard.cardwall || { };
tuleap.agiledashboard.cardwall.tracker_user_data = [ ];
tuleap.agiledashboard.cardwall.card = tuleap.agiledashboard.cardwall.card || { };
tuleap.agiledashboard.cardwall.cards = tuleap.agiledashboard.cardwall.cards || { };
tuleap.agiledashboard.cardwall.cards.selectEditors = tuleap.agiledashboard.cardwall.cards.selectEditors || [ ];

tuleap.agiledashboard.cardwall.card.updateAfterAjax = function( transport ) {

    var artifacts_modifications = $H(transport.responseJSON);
    var milestone_id;
    var rest_route_url;

    artifacts_modifications.each( function ( artifact ) {
        updateArtifact( artifact );
    });

    if (! thereIsMilestoneId()) {
        return;
    }

    milestone_id   = $F('milestone_id');
    rest_route_url = '/api/v1/milestones/' + milestone_id;

    new Ajax.Request(rest_route_url, {
        method : 'GET',
        onComplete : updateEffortViewValue
    });

    function updateArtifact( artifact ) {
        var artifact_id = artifact.key,
            values = artifact.value;

        $H( values ).each( function ( field ) {
            updateArtifactField( artifact_id, field );
        });
    }

    function updateArtifactField( artifact_id, field ) {
        var field_to_update_selector = '.card[data-artifact-id='+ artifact_id +'] .valueOf_' + field.key,
            field_value = ( field.value === '' ) ? ' - ' : field.value;

        $$( field_to_update_selector ).each( function ( element_to_update ) {
            updateFieldValue( element_to_update, field_value )
        });
    }

    function updateFieldValue( element, value ) {
        var element_editor = element.down( 'div' );

        if( element_editor ) {
            element_editor.update( value );
        } else {
            element.update( value );
        }
    }

    function updateEffortViewValue(transport) {
        var element = $('milestone_points_completion_bar');

        switch(element.readAttribute('data-count-style')) {
            case 'cards':
                updateOpenClosedViewValue(transport.responseJSON);
                break;
            case 'effort':
                updateRemainingEffortViewValue(transport.responseJSON);
                break;
        }
    }

    function updateOpenClosedViewValue(milestone_info) {
        var nb_closed;
        var nb_open;
        var nb_total;
        var element;

        if (typeof milestone_info.status_count === 'undefined') {
            return;
        }

        nb_open        = parseInt(milestone_info["status_count"]["open"]);
        nb_closed      = parseInt(milestone_info["status_count"]["closed"]);
        nb_total       = nb_open + nb_closed;
        element        = $('milestone_remaining_effort');

        element.update(nb_open+'/'+nb_total);
        updateInitialEffortProgressBar(nb_open);
    }

    function updateRemainingEffortViewValue(milestone_info) {
        var milestone_remaining_effort;
        var element;

        milestone_remaining_effort = parseFloat(milestone_info["remaining_effort"]);
        element                    = $('milestone_remaining_effort');

        element.update(milestone_remaining_effort);
        updateInitialEffortProgressBar(milestone_remaining_effort);
        if (tuleap.agiledashboard.cardwall.burndown) {
            tuleap.agiledashboard.cardwall.updateBurndown();
        }
    }

    function updateInitialEffortProgressBar(milestone_remaining_effort) {
        var completion_bar;
        var new_completion;
        var milestone_initial_effort;

        completion_bar = $('milestone_points_completion_bar');

        if (completion_bar != null) {

            milestone_initial_effort = parseFloat(completion_bar.readAttribute('data-initial-effort'));
            new_completion           = Math.ceil((milestone_initial_effort - milestone_remaining_effort) / milestone_initial_effort * 100);

            if (new_completion < 0) {
                new_completion = 0;
            }

            completion_bar.update(new_completion + '%');
            completion_bar.style.width = new_completion + '%';
        }
    }

    function thereIsMilestoneId() {
        return $('milestone_id') != undefined;
    }
};

tuleap.agiledashboard.cardwall.card.AbstractElementEditor = Class.create({
    field_id : null,

    fail : function(transport) {
        if( typeof transport === 'undefined' ) {
            return;
        }
        if( typeof console == 'object' && typeof console.error === 'function' ) {
            console.error( transport.responseText.stripTags() );
        }
    },

    userCanEdit : function() {
        return (this.field_id !== null)
    }
});

tuleap.agiledashboard.cardwall.card.TextElementEditor = Class.create(
    tuleap.agiledashboard.cardwall.card.AbstractElementEditor, {

    initialize : function( element ) {
        this.options           = { };
        this.element           = element;
        this.field_id          = element.readAttribute( 'data-field-id' );
        this.artifact_id       = element.up( '.card' ).readAttribute( 'data-artifact-id' );
        this.update_url        = codendi.tracker.base_url + '?func=artifact-update&aid=' + this.artifact_id;
        this.artifact_type     = element.readAttribute( 'data-field-type' );
        this.is_computed_field = (element.readAttribute( 'data-field-is-autocomputed' ) !== null);
        this.old_value         = element.readAttribute( 'data-field-old-value' );

        if(! this.userCanEdit() ) {
            return;
        }

        var container = this.createAndInjectTemporaryContainer();

        if (! this.ajaxCallback()) {
            return;
        }
        this.options[ 'callback' ]            = this.ajaxCallback();
        this.options[ 'onComplete' ]          = this.success();
        this.options[ 'onFailure' ]           = this.fail;
        this.options[ 'onFormCustomization' ] = this.addValidationOnTextEditor.bind(this);

        if (this.is_computed_field) {
            this.options[ 'onEnterEditMode' ]     = this.appendAutocomputedOverrideDiv.bind(this);
            this.options[ 'onLeaveEditMode' ]     = this.removeAutocomputedOverrideDiv.bind(this);
        }

        this.in_place_editor = new Ajax.InPlaceEditor( container, this.update_url, this.options );
    },

    appendAutocomputedOverrideDiv : function (in_place_editor) {
        var self = this;
        var autocompute_override_div = new Element('div');

        autocompute_override_div.writeAttribute('class', 'autocomputed_override');
        autocompute_override_div.update($(in_place_editor.element).up().previous().innerHTML);

        autocompute_override_div.select('a')[0].observe('click', function (event) {
            event.preventDefault();

            self.bindAutocomputeLink.bind(self)(this.readAttribute('data-field-id'));
        });

        $(in_place_editor.element).up().insert({ top: autocompute_override_div });
    },

    removeAutocomputedOverrideDiv : function (in_place_editor) {
        $(in_place_editor.element).previous().remove();
    },

    bindAutocomputeLink : function(field_id) {
        var parameters = { },
            linked_field = 'artifact[' + field_id +']';

        var self = this;

        var post_value = {
            is_autocomputed: 1,
            manual_value: ''
        };
        parameters[linked_field]      = JSON.stringify(post_value);

        new Ajax.Request(self.update_url, {
            parameters: parameters,
            onComplete: function(transport) {
                self.in_place_editor.wrapUp(transport);
            },
            onFailure: self.fail
        });
    },

    createAndInjectTemporaryContainer : function () {
        var clickable     = this.getClickableArea(),
            clickable_div = new Element( 'div' );

        clickable_div.update( clickable );
        this.element.update( clickable_div );

        return clickable_div;
    },

    getClickableArea : function() {
        var autocompute_label = '';

        if (this.element.readAttribute('data-field-is-autocomputed') === '1') {
            autocompute_label = ' ('+ codendi.locales.cardwall.autocomputed_label +')';
        }

        if( this.element.innerHTML == '' ) {
            return ' - ' ;
        }

        return this.element.innerHTML + autocompute_label;
    },

    ajaxCallback : function() {
        var field_id          = this.field_id;
        var is_computed_field = this.is_computed_field;

        return function setRequestData(form, value) {
            var parameters   = { },
                linked_field = 'artifact[' + field_id +']';
            if (is_computed_field) {
                if (! /^\d+$/.test(value)) {
                    return false;
                }

                var post_value = {
                    is_autocomputed: 0,
                    manual_value: value
                };

                parameters[linked_field] = JSON.stringify(post_value);
            } else {
                parameters[linked_field] = value;
            }

            return parameters;
        }
    },

    success : function() {
        return function updateCardInfo( transport ) {
            if( typeof transport != 'undefined' ) {
                tuleap.agiledashboard.cardwall.card.updateAfterAjax( transport );
            }
        }
    },

    addValidationOnTextEditor : function( in_place_editor ) {
        var pattern,
            message;

        switch (this.artifact_type ) {
            case 'float':
                pattern = '[0-9]*(\.[0-9]*)?';
                message = codendi.locales.cardwall_field_validation.error_message.float_type;
                break;
            case 'int':
                pattern = '[0-9]*';
                message = codendi.locales.cardwall_field_validation.error_message.int_type;
                break;
            default:
                pattern = '.';
                message = '';
        }

        in_place_editor._controls.editor.pattern = pattern;
        in_place_editor._controls.editor.title   = message;
    }
});

tuleap.agiledashboard.cardwall.card.SelectElementEditor = Class.create(
    tuleap.agiledashboard.cardwall.card.AbstractElementEditor, {
    null_user_id : 100,

    initialize : function( element ) {
        this.setProperties( element );

        if(! this.userCanEdit() ) {
            return;
        }

        this.fetchUserData();
        this.addOptions();

        var container = this.createAndInjectTemporaryContainer();
        var editor;

        editor = new Ajax.InPlaceMultiCollectionEditor(
            container,
            this.update_url,
            this.options
        );

        this.bindSelectedElementsToEditor(editor);
    },

    setProperties : function( element ) {
        this.element           = element;
        this.options           = { };
        this.tracker_user_data = [ ];

        this.field_id       = element.readAttribute( 'data-field-id' );
        this.artifact_id    = element.up( '.card' ).readAttribute( 'data-artifact-id' );
        this.artifact_type  = element.readAttribute( 'data-field-type' );

        this.update_url     = codendi.tracker.base_url + '?func=artifact-update&aid=' + this.artifact_id;
        this.collection_url = codendi.tracker.base_url + '?func=get-values&formElement=' + this.field_id;

        this.users          = { };
        this.is_display_avatar_selected = element.up('.cardwall_board').readAttribute('data-display-avatar');
    },

    fetchUserData : function() {
        this.tracker_user_data = tuleap.agiledashboard.cardwall.tracker_user_data;
    },

    isMultipleSelect : function () {
        return this.artifact_type === 'msb';
    },

    addOptions : function() {
        this.options[ 'multiple' ]      = this.isMultipleSelect();
        this.options[ 'collection' ]    = this.getAvailableUsers();
        this.options[ 'element' ]       = this.element;
        this.options[ 'callback' ]      = this.preRequestCallback();
        this.options[ 'onComplete' ]    = this.success();
        this.options[ 'onFailure' ]     = this.fail;
    },

    bindSelectedElementsToEditor : function( editor ) {
        
        editor.getSelectedUsers = function() {

            if (editor.element.select( '.avatar' ).length == 0) {                
                this.options.selected = getSelectedUsersByDisplayType('realname');
            } else {
                this.options.selected = getSelectedUsersByDisplayType('avatar');
            }
        };
        
        function getSelectedUsersByDisplayType(classname) {
                var values   = editor.element.select( '.'+ classname );
                var users = { };

                values.each( function( classname ) {
                    var id      = classname.readAttribute( 'data-user-id' );
                    users[ id ] = classname.readAttribute( 'title' );
                });
                
                return users;
            }
    },

    createAndInjectTemporaryContainer : function () {
        var clickable     = this.getClickableArea(),
            clickable_div = new Element( 'div' );

        clickable_div.update( clickable );
        this.element.update( clickable_div );

        return clickable_div;
    },

    getClickableArea : function() {
        if( this.element.innerHTML == '' ) {
            return ' - ' ;
        }

        return this.element.innerHTML;
    },

    getAvailableUsers : function() {
        var user_collection = [];

        if ( $H( this.users ).size() == 0 ) {
            this.users = this.tracker_user_data[ this.field_id ] || { };
        }

        if (  $H( this.users ).size() == 0 ) {
            this.fetchUsers();
        }

        $H( this.users ).each( function( user_details ) {
            user_collection.push( [ user_details.value.id, user_details.value.label ] );
        });

        return user_collection;
    },

    fetchUsers : function() {
        var users = this.getDefaultUsers();

        new Ajax.Request( this.collection_url, {
            method: 'GET',
            asynchronous : false,
            onSuccess : function ( data ) {

                $H( data.responseJSON ).each( function( user_details ){
                    var id        = user_details[0],
                        user_data = user_details[1];

                    users[ id ] = user_data;
                })
            }
        });

        this.users = users;
        this.tracker_user_data[ this.field_id ] = users;

        tuleap.agiledashboard.cardwall.tracker_user_data[ this.field_id ] = users;
    },

    getDefaultUsers : function() {
        var none_id = this.null_user_id;

        return {
            none_id : {
                "id"       : none_id,
                "label"  : "None",
                "username" : "None",
                "realname" : "None"
            }
        };
    },

    preRequestCallback : function() {
        var field_id        = this.field_id,
            is_multi_select = this.isMultipleSelect();

        return function setRequestData( form, value ) {
            var parameters = { };
            if ( is_multi_select ) {
                linked_field = 'artifact[' + field_id +'][]';
            } else {
                linked_field = 'artifact[' + field_id +']';
            }

            value = ( value.length === 0 ) ? '' : value;
            parameters[ linked_field ] = value;
            return parameters;
        }
    },

    success : function() {
        var field_id                     = this.field_id,
            is_multi_select              = (this.isMultipleSelect() === true),
            tracker_user_data            = this.tracker_user_data,
            is_display_avatar_selected   = this.is_display_avatar_selected;

        var self = this;

        return function updateCardInfo( transport, element ) {
            var new_values;

            if( typeof transport === 'undefined' ) {
                return;
            }

            element.update( '' );
            new_values = getNewValues( transport, is_multi_select, field_id );
            self.updateAssignedToValue( element, new_values );

            function getNewValues(transport, is_multi_select, field_id) {
                var new_values;

                if ( is_multi_select ) {
                    new_values = transport.request.parameters[ 'artifact[' + field_id + '][]' ];
                } else {
                    new_values = transport.request.parameters[ 'artifact[' + field_id + ']' ];
                }

                return new_values;
            }

            
        }

    },

    updateAssignedToValue : function( assigned_to_div, new_values ) {
        var updateFunction    = addUsername,
            field_id          = this.field_id,
            tracker_user_data = this.tracker_user_data;

        if (this.is_display_avatar_selected) {
            updateFunction = addAvatar;
        }

        if(new_values instanceof Array) {
            for(var i=0; i<new_values.length; i++) {
                updateFunction( assigned_to_div, new_values[i] );
            }
        } else if( typeof new_values === 'string' && new_values != this.null_user_id ){
            updateFunction( assigned_to_div, new_values );
        } else {
            assigned_to_div.update( ' - ' );
        }

        function addUsername(container, user_id) {
            var realname = tracker_user_data[ field_id ][ user_id ][ 'realname' ],
                label = tracker_user_data[ field_id ][ user_id ][ 'label' ],
                username_div;

            username_div = new Element( 'div' );
            username_div.addClassName( 'realname' );
            username_div.writeAttribute( 'title', label );
            username_div.writeAttribute( 'data-user-id', user_id );

            username_div.update(realname);

            container.insert( username_div );
            container.insert(' ');

        }

        function addAvatar( container, user_id ) {
            var username = tracker_user_data[ field_id ][ user_id ][ 'username' ],
                label = tracker_user_data[ field_id ][ user_id ][ 'label' ],
                avatar_img,
                avatar_div;

            avatar_div = new Element( 'div' );
            avatar_div.addClassName( 'avatar' );
            avatar_div.writeAttribute( 'title', label );
            avatar_div.writeAttribute( 'data-user-id', user_id );

            avatar_img = new Element('img', {
                src: '/users/' + username + '/avatar.png'
            });
            avatar_img.observe('load', function() {
                if( this.width == 0 || this.height == 0 ) {
                    return;
                }
            });
            avatar_div.appendChild(avatar_img);

            container.insert( avatar_div );
            container.insert(' ');
        }
    }

});

tuleap.agiledashboard.cardwall.fetchBurndown = function() {
    new Ajax.Request(
        '/api/v1/milestones/' + $F('milestone_id') + '/burndown',
    {
        method : 'GET',
        onSuccess: function (response) {
            if (! tuleap.agiledashboard.cardwall.burndown) {
                var append_element_selector = d3.select(".milestone-burndown");

                tuleap.agiledashboard.cardwall.burndown = new tuleap.agiledashboard.Burndown(d3, response.responseJSON);
                tuleap.agiledashboard.cardwall.burndown.display(append_element_selector);
            } else {
                tuleap.agiledashboard.cardwall.burndown.update(response.responseJSON);
            }
        }
    });
};

tuleap.agiledashboard.cardwall.updateBurndown = function() {
    new Ajax.Request(
        '/api/v1/milestones/' + $F('milestone_id') + '/burndown',
    {
        method : 'GET',
        onSuccess: function (response) {
            tuleap.agiledashboard.cardwall.burndown.update(response.responseJSON);
        }
    });
};

tuleap.agiledashboard.Burndown = Class.create({

    margin: { top: 7, right: 7, bottom: 7, left: 7 },
    width : 300,
    height: 85,

    initialize : function (d3, data, options) {
        this.d3   = d3;
        this.data = data;

        if (typeof(options) != 'undefined' && typeof(options.width) != 'undefined') {
            this.width = options.width;
        }
        if (typeof(options) != 'undefined' && typeof(options.height) != 'undefined') {
            this.height = options.height;
        }

        this.width = this.width - this.margin.left - this.margin.right;
        this.height = this.height - this.margin.top - this.margin.bottom;

        this.ideal_data  = [ this.data.capacity, 0 ];
    },

    display: function(append_element_selector) {
        this.defineAbscissas();
        this.defineOrdinates();
        this.defineLineFunctions();
        this.bootstrapTheChart(append_element_selector);
        this.paintAbscissas();
        this.paintOrdinates();
        this.paintTheIdealLine();
        this.paintTheActualLine();
        this.paintTheDots();
    },

    update: function(data) {
        this.data = data;
        this.repaintActual();
        this.repaintDots();
    },

    getXCoordinateForAGivenBurndownPoint: function(d, index) {
        return this.x(index) / this.data.duration;
    },

    defineAbscissas: function() {
        this.x = this.d3.scale.linear().range([0, this.width]);
        this.x.domain(this.d3.extent(this.ideal_data, function(d, index) { return index; }));
    },

    defineOrdinates: function() {
        this.y = this.d3.scale.linear().range([this.height, 0]);
        this.y.domain(this.d3.extent(this.data.points.concat(this.ideal_data)));
    },

    bootstrapTheChart: function(append_element_selector) {
        var svg = append_element_selector.append("svg")
            .attr("class", "chart")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        this.chart = svg.append("g").attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
    },

    defineLineFunctions: function() {
        this.ideal_line = this.d3.svg.line()
            .x(function(d, index) { return this.x(index); }.bind(this))
            .y(this.y);
        this.actual_line = this.d3.svg.line()
            .x(this.getXCoordinateForAGivenBurndownPoint.bind(this))
            .y(this.y);
    },

    paintAbscissas: function() {
        this.chart.append("line")
            .attr("class", "line ordinates")
            .attr("x1", 0)
            .attr("y1", this.height)
            .attr("x2", this.width)
            .attr("y2", this.height);
    },

    paintOrdinates: function() {
        this.chart.append("line")
            .attr("class", "line abscissas")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", this.height);
    },

    paintTheIdealLine: function() {
        this.chart.append("path")
            .datum(this.ideal_data)
            .attr("class", "line ideal")
            .attr("d", this.ideal_line);
    },

    paintTheActualLine: function() {
        this.chart.append("path")
            .datum(this.data.points)
            .attr("class", "line actual")
            .attr("d", this.actual_line);
    },

    paintTheDots: function() {
        this.chart
            .selectAll('circle')
            .data(this.data.points)
            .enter()
                .append("circle")
                .attr("class", "circle actual")
                .attr("r", "4")
                .attr("cx", this.getXCoordinateForAGivenBurndownPoint.bind(this))
                .attr("cy", this.y)
                .append("title")
                .text(function (d) { return d; });
    },

    repaintActual: function() {
        this.chart.select(".actual")
            .datum(this.data.points)
            .attr("d", this.actual_line);
    },

    repaintDots: function() {
        this.chart.selectAll('circle').remove();
        this.paintTheDots();
    }
});
