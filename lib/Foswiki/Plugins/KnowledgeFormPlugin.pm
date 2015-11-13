# See bottom of file for license and copyright information

package Foswiki::Plugins::KnowledgeFormPlugin;

use strict;
use warnings;

use Foswiki::Func ();
use Foswiki::Form ();

use Error qw( :try );
use Foswiki::OopsException ();
use Foswiki::AccessControlException ();

our $VERSION = '1.0';
our $RELEASE = "1.0";
our $SHORTDESCRIPTION = 'Formfield with tagcloud.';
our $NO_PREFS_IN_TOPIC = 1;

sub initPlugin {
    my ( $topic, $web ) = @_;

    Foswiki::Func::registerRESTHandler(
        'autocomplete', \&_restAutocomplete,
        authenticate => 0, http_allow => 'GET', validate => 0 );

    Foswiki::Func::registerRESTHandler(
        'tagcloud', \&_restTagcloud,
        authenticate => 0, http_allow => 'GET', validate => 0 );

    Foswiki::Func::registerTagHandler(
        'KNOWLEDGECLOUD', \&_KNOWLEDGECLOUD );

    Foswiki::Func::registerTagHandler(
        'KNOWLEDGESOLR', \&_KNOWLEDGESOLR );

    return 1;
}

sub _restAutocomplete {
    my ($session, $plugin, $verb, $response) = @_;

    my $query = Foswiki::Func::getRequestObject();

    my $formtopic = $query->param('formtopic');
    my ($formWeb, $formName) = Foswiki::Func::normalizeWebTopicName(undef, $formtopic);

    my $web = $query->param('targetweb') || $formWeb;

    my ($clouds, $searchString, $solrFields) = _processForm($session, $formWeb, $formName);

    my $searchIn = $query->param('searchin') || 'dummy';
    my $terms = $query->param('term') || '.?';
    $terms = join(' AND ', map{ "*$_" } split(m#\s+#, $terms));
    $searchString .= " $searchIn:($terms)";

    my $field = $query->param('field') || 'title';
    my $limit = $query->param('limit') || 10;

    my $search = <<SEARCH;
\%SOLRSEARCH{
    "web:$web $searchString"
    fields="$field"
    limit="0"
    order="title"
    rows="0"
    separator_$field="\$n"
    facets="$field"
    format_$field="\$key"
    facetlimit="$limit"
}\%
SEARCH

    my @results = split("\n", Foswiki::Func::expandCommonVariables($search));
    return "[".join(',', map{ $_ =~ s#"#\\"#g; "{\"label\":\"$_\",\"value\":\"$_\"}" } @results)."]";
}

# TODO: Error handling
sub _processForm {
    my ( $session, $formWeb, $formName, $clouds ) = @_;

    return "KnowledgeCloud: error reading form $formWeb.$formName: does not exist" unless Foswiki::Func::topicExists($formWeb, $formName);

    my $formDef;
    try {
      $formDef = new Foswiki::Form($session, $formWeb, $formName);
    }
    catch Foswiki::OopsException with {
        my $e = shift;
        return "KnowledgeCloud: Could not read form definition $formWeb.$formName: $e";
    } catch Foswiki::AccessControlException with {
        # Form definition not accessible, ignore
        my $e = shift->stringify();
        return "KnowledgeCloud: Access denied to definition $formWeb.$formName: $e";
    };

    return "KnowledgeCloud: error reading form $formWeb.$formName: (unknown reason)" unless $formDef;

    my $searchString = '';
    my @solrFields = ();

    $clouds = '' if defined $clouds;

    my $query = Foswiki::Func::getRequestObject();
    my $multiParam = $query->multi_param();

    my $formFields = $formDef->getFields() || ();
    foreach my $field ( @$formFields ) {
        next unless $field->{type} && ($field->{type} eq 'knowledge' || $field->{type} eq 'knowledge+multi' );
        my $solrType = ( $field->isMultiValued() ? 'lst' : 's' );
        my $solrFieldName = "field_$field->{name}_$solrType";

        $clouds .= <<CLOUD if defined $clouds;
<div class="lrFacet_$field->{name} tagCloud" style="display:none">
%TAGCLOUD{
  "%SOLRFORMAT{"lrSearchT" format_$solrFieldName="\$key:\$count" separator_$solrFieldName="###"}%"
  header="<div style='text-align:center; padding:15px;line-height:180%'>"
  format="<span style='font-size:\$weightpx; color:\$fadeRGB(104,144,184,0,102,255);' title='\$count'>\$term</span>"
  footer="</div>"
  buckets="30"
  offset="12"
  lowercase="off"
  stopwords="off"
  plural="on"
  min="0"
  filter="off"
  split="###"
}%
</div>
CLOUD

        my @param = $query->multi_param($field->{name});
        my $values = '';
        foreach my $eachParam ( @param ) {
            my $eachValues = join(' AND ', map{ $_ =~ s#"#\\\\\"#g; "\\\"$_\\\"" } grep{ $_ =~ m#\S# } split(m#\s*,\s*#, $eachParam ));
            if($eachValues) {
                $values .= ' AND ' if $values;
                $values .= $eachValues;
            }
        }
        $searchString .= " $solrFieldName:($values)" if $values;

        push(@solrFields, $solrFieldName);
    }

    return ($clouds, $searchString, join(',', @solrFields));
}

sub _restTagcloud {
    my ($session, $plugin, $verb, $response) = @_;

    my $query = Foswiki::Func::getRequestObject();
    my $formtopic = $query->param('formtopic');
    return 'Missing parameter: formtopic' unless $formtopic;
    my ($formWeb, $formName) = Foswiki::Func::normalizeWebTopicName(undef, $formtopic);

    my ($clouds, $searchString, $solrFields) = _processForm($session, $formWeb, $formName, 1);

    my $targetWeb = $query->param('targetweb') || $formWeb;

    my $search = <<SEARCH;
\%SOLRSEARCH{
    "web:$targetWeb $searchString"
    id="lrSearchT"
    fields="web,topic,$solrFields"
    order="title"
    rows="9999"
    facetlimit="9999"
    facets="$solrFields"
    facetmincount="1"
}\%
SEARCH

    Foswiki::Func::expandCommonVariables($search);

    return Foswiki::Func::expandCommonVariables("<div class='facetView'><div class='lrFacets'>$clouds</div></div>");
}

sub _KNOWLEDGESOLR {
    my ( $session, $attributes, $topic, $web ) = @_;

    # TODO new topic


    my $formName = $attributes->{form};
    unless($formName) {
        my ($meta, undef) = Foswiki::Func::readTopic($web, $topic);
        $formName = $meta->getFormName();
    }
    (my $formWeb, $formName) = Foswiki::Func::normalizeWebTopicName($web, $formName);
    return "KnowledgeCloud_No_form_found:$web.$topic" unless $formName && $formName ne $Foswiki::cfg{HomeTopicName};

    my ($clouds, $searchString, $solrFields) = _processForm($session, $formWeb, $formName);

    return $searchString;
}

sub _KNOWLEDGECLOUD {
    my ( $session, $attributes, $topic, $web ) = @_;

    # TODO new topic

    my $formName = $attributes->{form};
    unless($formName) {
        my ($meta, undef) = Foswiki::Func::readTopic($web, $topic);
        $formName = $meta->getFormName();
    }
    (my $formWeb, $formName) = Foswiki::Func::normalizeWebTopicName($web, $formName);
    return "<!-- KnowledgeCloud: No form found in $web.$topic -->" unless $formName;

    my $targetWeb = $attributes->{targetweb} || $web;

    my ($clouds, $searchString, $solrFields) = _processForm($session, $formWeb, $formName, 1);

    my $search = <<SEARCH;
\%SOLRSEARCH{
    "web:$targetWeb $searchString"
    id="lrSearchT"
    fields="web,topic,$solrFields"
    order="title"
    rows="9999"
    facetlimit="9999"
    facets="$solrFields"
    facetmincount="1"
}\%
SEARCH

    return "<div class='facetView'><!-- $search --><div class='lrFacets'>$clouds</div></div>";
}
