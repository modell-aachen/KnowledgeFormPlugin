# See bottom of file for license and copyright information
package Foswiki::Form::Knowledge;

use strict;
use warnings;

use Foswiki::Form::ListFieldDefinition ();
use Foswiki::Plugins ();
our @ISA = ('Foswiki::Form::ListFieldDefinition');

sub new {
    my $class = shift;
    my $this = $class->SUPER::new(@_);

    $this->{validModifiers} = [ '+multi' ];

    return $this;
}

sub finish {
    my $this = shift;
    $this->SUPER::finish();
}

sub isValueMapped { return 0; }

sub getDefaultValue {
    my $this = shift;

    my $query = Foswiki::Func::getRequestObject();
    my $value = $query->param($this->{name});

    $value = '' unless defined $value;    # allow 0 values

    return $value;
}

sub getSelect2Input {
    my ( $this, $value, $attrs ) = @_;

    my $lst = ( $this->isMultiValued() ? ' lst' : '');
    my $formname = $this->{web} .'.'. $this->{topic};

    Foswiki::Func::addToZone('script', 'KnowledgeScript', <<SCRIPT, 'JQUERYPLUGIN::FOSWIKI');
<script type="text/javascript" src="%PUBURLPATH%/%SYSTEMWEB%/KnowledgeFormPlugin/Knowledge.js"></script>
SCRIPT
    Foswiki::Func::addToZone('head', 'KnowledgeCSS', <<CSS);
<style type="text/css" media="all">\@import url("%PUBURLPATH%/%SYSTEMWEB%/KnowledgeFormPlugin/Knowledge.css")</style>
CSS

    # XXX data-web
    return "<input class='MetaFacet_select2 search$lst' type='hidden' data-web='$this->{web}' data-form='$formname' name='$this->{name}' value='$value' />"
}

sub renderForDisplay {
    my ( $this, $format, $value, $attrs ) = @_;

    $format = $this->SUPER::renderForDisplay( $format, $value, $attrs );

#    my $targetWeb = $topicObject->web;
#    my $targetTopic = $topicObject->topic;


    $format =~ s#\$select2#getSelect2Input($this, $value, $attrs)#ge;

    return $format;
}

sub renderForEdit {
    my ($this, $topicObject, $value) = @_;

    my $request = Foswiki::Func::getRequestObject();

    my $size = 50; # TODO

    my $targetWeb = $topicObject->web;
    my $targetTopic = $topicObject->topic;

    my $formname = $this->{web} .'.'. $this->{topic};

    my $lst = ($this->isMultiValued() ? ' lst' : '');

    Foswiki::Func::addToZone('script', 'KnowledgeScript', <<SCRIPT, 'JQUERYPLUGIN::FOSWIKI');
<script type="text/javascript" src="%PUBURLPATH%/%SYSTEMWEB%/KnowledgeFormPlugin/Knowledge.js"></script>
SCRIPT
    Foswiki::Func::addToZone('head', 'KnowledgeCSS', <<CSS);
<style type="text/css" media="all">\@import url("%PUBURLPATH%/%SYSTEMWEB%/KnowledgeFormPlugin/Knowledge.css")</style>
CSS

    return (
        '',
        "<input class='MetaFacet_select2$lst search addNew doNotFilter' type='hidden' name='$this->{name}' data-form='$formname' data-web='$targetWeb' value='$value' />"
    );
}

sub populateMetaFromQueryData {
    my ( $this, $query, $meta, $old ) = @_;
    my $value;
    my $bPresent = 0;

    return unless $this->{name};

    my %names = map { $_ => 1 } $query->multi_param;

    if ( $names{ $this->{name} } ) {

        # Field is present in the request
        $bPresent = 1;
        if ( $this->isMultiValued() ) {
            my @values = $query->multi_param( $this->{name} );

            if ( scalar(@values) == 1 && defined $values[0] ) {
                @values = split( /,|%2C/, $values[0] );
            }
            $value = join(',', @values);
        }
        else {

            # Default the value to the empty string (undef would result
            # in the old value being restored)
            # Note: we test for 'defined' because value can also be 0 (zero)
            $value = $query->param( $this->{name} );
            $value = '' unless defined $value;
            if ( $this->{session}->inContext('edit') ) {
                $value = Foswiki::expandStandardEscapes($value);
            }
        }
    }

    # Find the old value of this field
    my $preDef;
    foreach my $item (@$old) {
        if ( $item->{name} eq $this->{name} ) {
            $preDef = $item;
            last;
        }
    }
    my $def;

    if ( defined($value) ) {

        # mandatory fields must have length > 0
        if ( $this->isMandatory() && length($value) == 0 ) {
            return ( 0, $bPresent );
        }

        # NOTE: title and name are stored in the topic so that it can be
        # viewed without reading in the form definition
        my $title = $this->{title};
        if ( $this->{definingTopic} ) {
            $title = '[[' . $this->{definingTopic} . '][' . $title . ']]';
        }
        $def = $this->createMetaKeyValues(
            $query, $meta,
            {
                name  => $this->{name},
                title => $title,
                value => $value
            }
        );
    }
    elsif ($preDef) {
        $def = $preDef;
    }
    else {
        return ( 0, $bPresent );
    }

    $meta->putKeyed( 'FIELD', $def ) if $def;

    return ( 1, $bPresent );
}

1;
__END__
Foswiki - The Free and Open Source Wiki, http://foswiki.org/

Copyright (C) 2013-2014 Foswiki Contributors. Foswiki Contributors
are listed in the AUTHORS file in the root of this distribution.
NOTE: Please extend that file, not this notice.

Additional copyrights apply to some or all of the code in this
file as follows:

Copyright (C) 2001-2007 TWiki Contributors. All Rights Reserved.
TWiki Contributors are listed in the AUTHORS file in the root
of this distribution. NOTE: Please extend that file, not this notice.

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version. For
more details read LICENSE in the root of this distribution.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

As per the GPL, removal of this notice is prohibited.

