function addGroup(e, newGroupForm, firstColumn) {

    e.preventDefault();
    removeTempEls();

    if (!newGroupForm) {
        newGroupForm = document.getElementById('new-group-form');
    }

    var secondColumn = document.getElementById('group-column-1'),
        thirdColumn = document.getElementById('group-column-2');

    var firstColumnArray = firstColumn.getElementsByClassName('link-panel'),
        addToColumn;

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
    } else {
        addToColumn = 1;
    }

    var eventTarget = e.target;
    var XHR = new XMLHttpRequest();

    XHR.addEventListener('load', function(event) {

        var responseObject = JSON.parse(XHR.responseText);

        if(responseObject.error) {


        } else {

            switch (addToColumn) {
                case 1:
                    createNewGroup(responseObject.pageid, responseObject.groupid, responseObject.grouptitle, responseObject.groupdesc, firstColumn, firstColumn);
                    break;
                case 2:
                    createNewGroup(responseObject.pageid, responseObject.groupid, responseObject.grouptitle, responseObject.groupdesc, firstColumn, secondColumn);
                    break;
                case 3:
                    createNewGroup(responseObject.pageid, responseObject.groupid, responseObject.grouptitle, responseObject.groupdesc, firstColumn, thirdColumn);
                    break;
            }

            formItems[0].value = '';
            formItems[1].value = '';
            
        }
    }, false);

    XHR.addEventListener('error', function(event) {
        //handle error logic here
    }, false);

    var urlEncodedData = "",
        urlEncodedDataPairs = [];

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
                formGroupDesc = formItems[i];
                break;
        }

        urlEncodedDataPairs.push( encodeURIComponent(formItems[i].name) + '=' + encodeURIComponent(formItems[i].value) );
    }

    urlEncodedDataPairs.push('pageid=' + pageID);

    var formURL = '/' + pageID + '/newsession';

    urlEncodedData = urlEncodedDataPairs.join('&').replace('/%20/g', '+');
    XHR.open('POST', formURL);

    XHR.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    XHR.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    XHR.send(urlEncodedData);

}

//may need to use this function to delete links too. Can check if parent form has createLinkForm
function addLink(e) {

    e.preventDefault();
    removeTempEls();

    var eventTarget = e.target;
    var XHR = new XMLHttpRequest();

    XHR.addEventListener('load', function(event) {

        var responseObject = JSON.parse(XHR.responseText);

        var groupEl = document.getElementById(groupID),
            linkFormArray = groupEl.getElementsByClassName('createLinkForm'),
            nextSibling = linkFormArray[linkFormArray.length - 1].nextSibling;

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
                newUrlEl = document.createElement('a');

            newUrlEl.setAttribute('href', responseObject.newURL);
            newUrlEl.className = 'group-link mui--align-middle';
            var newUrlTitle = document.createTextNode(responseObject.newLinkTitle);
            newUrlEl.appendChild(newUrlTitle);
            newLinkContainer.appendChild(newUrlEl);

            if(nextSibling === undefined || null || {}) {
                var newDivider = document.createElement('div');
                newDivider.className = 'mui-divider link-divider';
                groupEl.appendChild(newDivider);
            }

            groupEl.appendChild(newLinkContainer);

            formUrlTitle.value = '';
            formNewUrl.value = '';

        }
    }, false);

    XHR.addEventListener('error', function(event) {
        //handle error logic here
    }, false);

    var parentForm = eventTarget.parentNode,
        formItems = parentForm.getElementsByTagName('input');

    var urlEncodedData = "",
        urlEncodedDataPairs = [];
    
    var formUrlTitle = '',
        formNewUrl = '';

    var pageID = document.getElementById('page-id').value,
       groupID = document.getElementById('group-id').value;
    console.log('pageid: ' + pageID + ' groupid: ' + groupID);

    for (var i = 0; i < formItems.length; i++) {
        switch (formItems[i].name) {
            case 'newlinktitle':
                formUrlTitle = formItems[i];
                break;
            case 'newlinkurl':
                formNewUrl = formItems[i];
                break;
        }

        urlEncodedDataPairs.push( encodeURIComponent(formItems[i].name) + '=' + encodeURIComponent(formItems[i].value) );
    }

    urlEncodedDataPairs.push(encodeURIComponent('pageid=') + pageID);
    urlEncodedDataPairs.push(encodeURIComponent('groupid=') + groupID);

    var formURL = '/' + pageID + '/' + groupID + '/addlink';
    console.log('formURL: ' + formURL);

    urlEncodedData = urlEncodedDataPairs.join('&').replace('/%20/g', '+');
    XHR.open('POST', formURL);

    XHR.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    XHR.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    XHR.setRequestHeader('Content-Length', urlEncodedData.length);

    XHR.send(urlEncodedData);

}

function editCollection(e, linkGroupArray) {

    for (var i=0; i < linkGroupArray.length; i++) {
        linkGroupArray[i].removeEventListener('click', addLink, false);
        document.createElement('form');
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
        editCollectionButton.addEventListener('submit', function(e){ editCollection(e, linkGroupArray) }, false);
    }

}

function removeTempEls() {

    var tempElArray = document.getElementsByClassName('temp-element');

    for (var i = 0; i < tempElArray.length; i++) {
        var removeEl = tempElArray[i];
        var parentEl = removeEl.parentNode;
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