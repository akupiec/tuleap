<?php
//
// Copyright (c) Xerox Corporation, CodeX Team, 2001-2003. All rights reserved
//
// $Id$
//
//
//  Written for CodeX by Stephane Bouhet
//

//require_once($DOCUMENT_ROOT.'/../common/tracker/ArtifactFactory.class');

// Check if a user can submit a new without loggin
if ( !user_isloggedin() && !$ath->allowsAnon() ) {
	exit_not_logged_in();
	return;
}

// Check if this tracker is valid (not deleted)
if ( !$ath->isValid() ) {
	exit_error('Error',"This tracker is no longer valid.");
}

//
//  make sure this person has permission to add artifacts
//
if (!$ath->userIsTech() && !$ath->isPublic() ) {
    exit_permission_denied();
}

// Display the menus
$ath->header(array('title'=>'Add A '.$ath->getCapsItemName(),'titlevals'=>array($ath->getName()),'pagename'=>'tracker_browse',
	'atid'=>$ath->getID(),'sectionvals'=>array($group->getPublicName()),'help' => 'ArtifactSubmission.html'));

// Display the artifact items according to all the parameters
$ah->displayAdd();

// Display footer page
$ath->footer(array());

?>
