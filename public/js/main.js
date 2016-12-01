function ajaxPOST(urlEncodedDataPairs, formURL, callbackArray, cb) {

    var XHR = new XMLHttpRequest();

    XHR.addEventListener('load', function(event) {
        var responseObject = JSON.parse(XHR.responseText);
        cb(responseObject, callbackArray);
    }, false);

    XHR.addEventListener('error', function(event) {
        //handle error logic here
    }, false);

    var urlEncodedData = urlEncodedDataPairs.join('&').replace('/%20/g', '+');
    XHR.open('POST', formURL);

    XHR.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    XHR.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    XHR.send(urlEncodedData);

}

function addGroupCallback(responseObject, callbackArray) {
    /*
        callbackArray[0]: addToColumn
        callbackArray[1]: firstColumn
        callbackArray[2]: secondColumn
        callbackArray[3]: thirdColumn
        callbackArray[4]: formItems
    */
    switch (callbackArray[0]) {
        case 1:
            createNewGroup(responseObject.pageid, responseObject.groupid, responseObject.grouptitle, responseObject.groupdesc, callbackArray[1], callbackArray[1]);
            break;
        case 2:
            createNewGroup(responseObject.pageid, responseObject.groupid, responseObject.grouptitle, responseObject.groupdesc, callbackArray[1], callbackArray[2]);
            break;
        case 3:
            createNewGroup(responseObject.pageid, responseObject.groupid, responseObject.grouptitle, responseObject.groupdesc, callbackArray[1], callbackArray[3]);
            break;
    }

    callbackArray[4][0].value = '';
    callbackArray[4][1].value = '';

    callbackArray = [];

}

function addLinkCallback(responseObject, callbackArray) {
    /*
        callbackArray[0]: groupID
        callbackArray[1]: parentForm
        callbackArray[2]: formUrlTitle
        callbackArray[3]: formNewUrl
    */

    var groupEl = document.getElementById(callbackArray[0]),
        nextSibling = callbackArray[1].nextElementSibling;

    if(responseObject.error) {


        if(groupEl.getElementsByClassName('temp-element').length === 0) {

            var newEl = document.createElement('div'),
                errorText = document.createTextNode(responseObject.error);

            newEl.appendChild(errorText);
            newEl.className = 'mui--text-body2 mui--text-center error-text temp-element';

            groupEl.insertBefore(newEl, nextSibling);
        } 

    } else {

        var newLinkContainer = document.createElement('div'),
            newLinkInput = document.createElement('input'),
            newUrlEl = document.createElement('a');

        newLinkContainer.setAttribute('class', 'link-div');

        newLinkInput.setAttribute('type', 'hidden');
        newLinkInput.setAttribute('name', 'link-del-id');
        newLinkInput.setAttribute('value', responseObject.newLinkId);
        newLinkInput.setAttribute('class', 'link-id');

        newUrlEl.setAttribute('href', responseObject.newURL);
        newUrlEl.className = 'group-link mui--align-middle';
        var newUrlTitle = document.createTextNode(responseObject.newLinkTitle);
        newUrlEl.appendChild(newUrlTitle);
        newLinkContainer.appendChild(newUrlEl);
        console.log(JSON.stringify(callbackArray[1]));
        if(nextSibling === undefined || null) {
            var newDivider = document.createElement('div');
            newDivider.className = 'mui-divider link-divider';
            groupEl.appendChild(newDivider);
        }

        groupEl.appendChild(newLinkContainer);

        callbackArray[2].value = '';
        callbackArray[3].value = '';

    }

    callbackArray = [];
    
}

function addGroup(e, newGroupForm, firstColumn) {

    e.preventDefault();
    removeTempEls();

    if (!newGroupForm) {
        newGroupForm = document.getElementById('new-group-form');
    }

    var secondColumn = document.getElementById('column-num-1'),
        thirdColumn = document.getElementById('column-num-2');

    var firstColumnArray = firstColumn.getElementsByClassName('link-panel'),
        addToColumn = 1;

    if (secondColumn) {
        secondColumnArray = secondColumn.getElementsByClassName('link-panel');
    } else {
        secondColumn = createNewColumn('group-column-1', firstColumn);
        secondColumnArray = secondColumn.getElementsByClassName('link-panel');
    }

    if (thirdColumn) {
        thirdColumnArray = thirdColumn.getElementsByClassName('link-panel');
    } else {
        thirdColumn = createNewColumn('group-column-2', firstColumn);
        thirdColumnArray = thirdColumn.getElementsByClassName('link-panel');
    }

    if (firstColumnArray.length > secondColumnArray.length) {
        addToColumn = 2;
    } else if (secondColumnArray.length > thirdColumnArray.length) {
        addToColumn = 3;
    } 
    var eventTarget = e.target;

    var urlEncodedDataPairs = [];

    var formItems = newGroupForm.getElementsByTagName('input');
    
    var pageID = document.getElementById('page-id').value;
    var formGroupTitle = '',
        formGroupDesc = '';

    for (var i = 0; i < formItems.length; i++) {

        switch (formItems[i].name) {
            case 'grouptitle':
                formGroupTitle = formItems[i].value;
                break;
            case 'groupdesc':
                formGroupDesc = formItems[i].value;
                break;
        }

        urlEncodedDataPairs.push( encodeURIComponent(formItems[i].name) + '=' + encodeURIComponent(formItems[i].value) );
    }

    urlEncodedDataPairs.push('pageid=' + pageID);

    var formURL = '/' + pageID + '/newsession';

    var callbackArray = [addToColumn, firstColumn, secondColumn, thirdColumn, formItems];

    ajaxPOST(urlEncodedDataPairs, formURL, callbackArray, addGroupCallback);

}

//may need to use this function to delete links too. Can check if parent form has createLinkForm
function addLink(e) {

    e.preventDefault();
    removeTempEls();

    var eventTarget = e.target;
    var parentForm = eventTarget.parentNode,
        formItems = parentForm.getElementsByTagName('input');

    var urlEncodedDataPairs = [];
    
    var formUrlTitle = '',
        formNewUrl = '',
        groupID = '';

    var pageID = document.getElementById('page-id').value;

    for (var i = 0; i < formItems.length; i++) {
        switch (formItems[i].name) {
            case 'groupid':
                groupID = formItems[i].value;
                console.log(groupID);
                break;
            case 'newlinktitle':
                formUrlTitle = formItems[i].value;
                break;
            case 'newlinkurl':
                formNewUrl = formItems[i].value;
                break;
        }

        urlEncodedDataPairs.push( encodeURIComponent(formItems[i].name) + '=' + encodeURIComponent(formItems[i].value) );
    }

    urlEncodedDataPairs.push(encodeURIComponent('pageid=') + pageID);
    urlEncodedDataPairs.push(encodeURIComponent('groupid=') + groupID);

    var formURL = '/' + pageID + '/' + groupID + '/addlink';

    var callbackArray = [groupID, parentForm, formUrlTitle, formNewUrl];

    ajaxPOST(urlEncodedDataPairs, formURL, callbackArray, addLinkCallback);

}

function doneEditing(e, editCollButton, linkGroupArray, funcToRemove) {

    e.preventDefault();

    editCollButton.reset();
    editCollButton.parentNode.removeEventListener('submit', funcToRemove);
    editCollButton.parentNode.addEventListener('submit', function(e){ editCollection(e, linkGroupArray, arguments.callee) }, false);

    removeTempEls();

    for (var i = 0; i < linkGroupArray.length; i++) {
        var addLinkArray = linkGroupArray[i].getElementsByClassName('createLinkForm');
        addLinkArray[0].style.display = 'block';
    }

}

function removeLink(e, linkIdToRemove) {

    var urlEncodedDataPairs = [];

    urlEncodedDataPairs.push('delinkid=' + linkIdToRemove);

    var pageID = document.getElementById('page-id').value;

    var formURL = '/' + pageID + '/newsession';

    var callbackArray = [addToColumn, firstColumn, secondColumn, thirdColumn, formItems];

    ajaxPOST(urlEncodedDataPairs, formURL, callbackArray, addGroupCallback);
}

function editCollection(e, linkGroupArray, funcToRemove) {

    e.preventDefault();

    var eventTarget = e.target; 
    eventTarget.reset();
    eventTarget.parentNode.removeEventListener('submit', funcToRemove);
    eventTarget.parentNode.addEventListener('submit', function(e){ doneEditing(e, eventTarget, linkGroupArray, arguments.callee) }, false);

    var clearButton = document.createElement('button');
    var clearButtonText = document.createTextNode('X');
    clearButton.appendChild(clearButtonText); 
    clearButton.className = 'mui-btn mui-btn--small mui-btn--danger mui--text-center mui--text-body temp-element';

    for (var i = 0; i < linkGroupArray.length; i++) {
        var addLinkArray = linkGroupArray[i].getElementsByClassName('createLinkForm');
        addLinkArray[0].style.display = 'none';

        var linkDivArray = linkGroupArray[i].getElementsByClassName('link-div');

        for (var j = 0; j < linkDivArray.length; j++) {
            var firstElChild = linkDivArray[j].firstElementChild;
            var delLinkId = firstElChild.value;
            linkDivArray[j].insertBefore(clearButton.cloneNode(true), firstElChild.nextElementSibling);
            clearButton.addEventListener('click', function(e){ removeLink(e, delLinkId) }, false);
        }
    }

}

function setup() {

    var linkGroupArray = document.getElementsByClassName('link-panel');

    for (var i = 0; i < linkGroupArray.length; i++) {
        linkGroupArray[i].addEventListener('submit', function(e) { addLink(e); }, false);
    }

    var firstColumn = document.getElementById('column-num-0');

    if (firstColumn) {
        var newGroupForm = document.getElementById('new-group-form');
        newGroupForm.addEventListener('submit', function(e) { addGroup(e, newGroupForm, firstColumn); }, false);
        
        var editCollectionButton = document.getElementById('edit-form');
        editCollectionButton.addEventListener('submit', function(e){ editCollection(e, linkGroupArray, arguments.callee) }, false);
    }

}

function removeTempEls() {

    var removeEl,
        parentEl,
        tempElArray = document.getElementsByClassName('temp-element');

    for (var i = tempElArray.length - 1; i >= 0; i--) {
        removeEl = tempElArray[i];
        parentEl = removeEl.parentNode;
        parentEl.removeChild(removeEl);
    }

}

function createNewColumn(columnID, masterColumn) {

    var dupColumnContainer = masterColumn.cloneNode(false);
    dupColumnContainer.setAttribute('id', columnID);

    var masterColumnParent = masterColumn.parentNode;
    masterColumnParent.appendChild(dupColumnContainer);

    return dupColumnContainer;

}

function createNewGroup(pageID, groupID, groupTitle, groupDesc, masterColumn, currentColumn) {
    
    var masterGroupContainer = masterColumn.firstElementChild;
    var masterGroupTitle = masterGroupContainer.getElementsByClassName('group-title');
    masterGroupTitle = masterGroupTitle[0];

    var masterGroupDesc = masterGroupContainer.getElementsByClassName('group-desc');
    masterGroupDesc = masterGroupDesc[0];

    var masterGroupCreateForm = masterGroupDesc.nextElementSibling;

    var dupGroupContainer = masterGroupContainer.cloneNode(false);
    dupGroupContainer.setAttribute('id', groupID);

    var dupGroupTitle = masterGroupTitle.cloneNode(false),
        dupGroupTitleText = document.createTextNode(groupTitle);
    dupGroupTitle.appendChild(dupGroupTitleText);

    var dupGroupDesc = masterGroupDesc.cloneNode(false),
        dupGroupDescText = document.createTextNode(groupDesc);
    dupGroupDesc.appendChild(dupGroupDescText);

    var dupGroupFormContainer = masterGroupCreateForm.cloneNode(true),
        dupGroupCreateForm = dupGroupFormContainer.firstElementChild,
        groupFormAction = '/' + pageID + '/' + groupID + '/addlink';
    dupGroupCreateForm.setAttribute('action', groupFormAction);
    dupGroupFormContainer.addEventListener('submit', function(e) { addLink(e); }, false);

    var dupGroupFormArray = dupGroupCreateForm.getElementsByTagName('input'),
        dupGroupFormPageId = dupGroupFormArray[0];
    dupGroupFormPageId.setAttribute('value', pageID);
    var dupGroupFormGroupId = dupGroupFormArray[1];
    dupGroupFormGroupId.setAttribute('value', groupID);

    dupGroupContainer.appendChild(dupGroupTitle);
    dupGroupContainer.appendChild(dupGroupDesc);
    dupGroupContainer.appendChild(dupGroupFormContainer);

    currentColumn.appendChild(dupGroupContainer);

}

window.addEventListener('load', setup, false);