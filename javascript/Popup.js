  /**
 * Created by AstafyevaLA on 29.04.2014.
 */
var popupData = new PopupData();
var backGround;
window.addEventListener('load', init, false);

// initialization
function init() {
    backGround = chrome.extension.getBackgroundPage();
    backGround.LogMsg('!!! Popup init started');
    changeState(popupData.windowStates.ST_START);

    LocalizePage();

    // clearing saved task and event if keeping time is over
    if (backGround.popupSettings.CheckKeepingTimeOver()) {
        backGround.LogMsg('Keeping time is over');
        backGround.popupSettings.ClearSavedEvent();
        backGround.popupSettings.ClearSavedTask();
    }

    // setting the current state
    if (!backGround.loader.TokenNotNull) {
        changeState(popupData.windowStates.ST_DISCONNECTED);
        backGround.LogMsg('Popup: disconnected');
    }
    else {
            GetGoogleInfoFromBackGround();

            if (backGround.loader.isLoading()) {
                changeState(popupData.windowStates.ST_CONNECTING);
                backGround.LogMsg('Popup: disconnected');
            }
            else {
                if (backGround.loader.isLoadedOk()) {
                    backGround.LogMsg('Popup: taking old vals');

                    changeState(popupData.windowStates.ST_CONNECTED);
                    backGround.loader.Load();
                }
                else {
                    changeState(popupData.windowStates.ST_CONNECTING);
                }

            }

            backGround.markCounter.Read(function() {
                if (backGround.markCounter.checkReadOk() && backGround.markCounter.checkMaximum() && popupData.windowStates.GetCurrentState() == popupData.windowStates.ST_CONNECTED) {
                    changeState(popupData.windowStates.ST_ASKFORMARK);
                }
            });

    }

    //fill combos
    FillCombo($('combo-repetition-interval'), backGround.spr.repetitionPeriodList.itemsLocale);
    for (var i=1; i<= RemindersLib.REMINDER_MAX; i++) {
        var combo = $(RemindersLib.getRemindComboName(i));
        FillCombo(combo, backGround.spr.reminderTimesList.itemsLocale);
        var comboMethods = $(RemindersLib.getRemindMethodComboName(i));
        FillCombo(comboMethods, backGround.spr.reminderMethodsList.itemsLocale);
    }

    RestoreTaskInProcess();
    RestoreEventInProcess();
    OnRepeatCheckChanged();
    SetButtonAddTaskState();
    SetButtonAddEventState();
    AddEventHandlers();
    testfunction();
}

// this event fires when popup closes
window.onunload = function() {
    backGround.LogMsg("closed!");

    if (backGround.popupSettings.SavedTaskExists()) {
          var taskInProcess = backGround.popupSettings.GetSavedTask();
          taskInProcess.name = $('input-task-name').value;
          taskInProcess.listName = $('combo-task-list').value;
          taskInProcess.listId = popupData.getTaskIdByName(taskInProcess.listName);
          if ($('checkbox-with-date').checked) {
              if (taskInProcess.date == null) {
                  taskInProcess.date = new MyDate();
              }
                  taskInProcess.date.setFromInputValue($('input-task-date').value);
          }

          taskInProcess.notes = $('input-task-comment').value;
          taskInProcess.notesRows = $('input-task-comment').style.height;
    }

    if (backGround.popupSettings.SavedEventExists()) {
         var eventInProcess = backGround.popupSettings.GetSavedEvent();
         eventInProcess.name = $('input-event-name').value;
         eventInProcess.listName = $('combo-event-calendar').value;
         eventInProcess.listId = popupData.getCalendarIdByName(eventInProcess.listName);
         eventInProcess.dateStart = new MyDate();
         eventInProcess.dateStart.setFromInputValue($('input-event-from').value);
         eventInProcess.dateEnd = new MyDate();
         eventInProcess.dateEnd.setFromInputValue($('input-event-to').value);
         eventInProcess.timeStart = new MyTime();
         eventInProcess.timeStart.setFromInputValue($('input-event-from-time').value);
         eventInProcess.timeEnd = new MyTime();
         eventInProcess.timeEnd.setFromInputValue($('input-event-to-time').value);
         eventInProcess.description = $('input-event-comment').value;
         eventInProcess.allDay = $('checkbox-all-day').checked;
         eventInProcess.place = $('input-event-place').value;
         var recurrenceTypeIndex = $('checkbox-repetition').checked? $('combo-repetition-interval').selectedIndex : -1;
         eventInProcess.recurrenceTypeValue = recurrenceTypeIndex  > -1 ? backGround.spr.repetitionPeriodList.items[recurrenceTypeIndex] : null;
         eventInProcess.reminderTimeArray = MakeReminderTimeArray();
         eventInProcess.reminderMethodArray = MakeReminderMethodArray();
    }

    backGround.popupSettings.lastSelectedTaskList = popupData.getTaskIdByName($('combo-task-list').value);
    backGround.popupSettings.lastSelectedCalendar = popupData.getCalendarIdByName($('combo-event-calendar').value);

    backGround.popupSettings.SetStartKeepingTime();
    backGround.markCounter.Save();
}

/* when popup closes edited task is saved in the taskInProcess variable */
/* this function restores this task in edit boxes*/
/* if we don`t have task to restore, function sets default values to task fields*/
function RestoreTaskInProcess() {
    var myDate = new MyDate();
    myDate.setStartNextHour();

    if (backGround.popupSettings.SavedTaskExists()) {
        var taskInProcess = backGround.popupSettings.GetSavedTask();
        $('input-task-name').value = taskInProcess.name;
        $('input-task-date').value = taskInProcess.date != null ? taskInProcess.date.toInputValue() : /*CurrDateStrOffset(new Date())*/ myDate.toInputValue();
        $('input-task-comment').value = taskInProcess.notes;
        $('checkbox-with-date').checked = taskInProcess.date != null;
        $('input-task-date').style.display = taskInProcess.date != null ? '': 'none';
    }
    else {
        $('input-task-name').value = '';
        $('input-task-date').value = /*CurrDateStrOffset(new Date());*/ myDate.toInputValue();
        $('input-task-comment').value = '';
        $('checkbox-with-date').checked = true;
        $('input-task-date').style.display = '';
    }
}

/* when popup closes edited event is saved in the eventInProcess variable */
/* this function restores this event in edit boxes*/
/* if we don`t have event to restore, function sets default values to event fields */
function RestoreEventInProcess() {

    if (backGround.popupSettings.SavedEventExists()) {
        var eventInProcess = backGround.popupSettings.GetSavedEvent();
        $('input-event-name').value = eventInProcess.name;
        $('input-event-from').value = eventInProcess.dateStart.toInputValue();
        $('input-event-to').value= eventInProcess.dateEnd.toInputValue();
        $('input-event-from-time').value = eventInProcess.timeStart.toInputValue();
        $('input-event-to-time').value= eventInProcess.timeEnd.toInputValue();
        $('input-event-comment').value = eventInProcess.description;
        $('checkbox-all-day').checked = eventInProcess.allDay;
        $('input-event-place').value = eventInProcess.place;
        $('checkbox-repetition').checked =  eventInProcess.recurrenceTypeValue != null;
        $('combo-repetition-interval').style.display = eventInProcess.recurrenceTypeValue != null ? '' : 'none';

        // restoring repetition period
        if (eventInProcess.recurrenceTypeValue != null) {
            var index = backGround.spr.repetitionPeriodList.IndexOf(eventInProcess.recurrenceTypeValue);
            $('combo-repetition-interval').selectedIndex = index;
        }

        RestoreReminders(eventInProcess.reminderTimeArray, eventInProcess.reminderMethodArray);
    }
    else {
        // default value
        var todayDate = new MyDate();
        todayDate.setStartNextHour();
        var todayTime = new MyTime();
        todayTime.setStartNextHour();
        // default values current date next hour - current date next hour + one hour
        $('input-event-name').value = '';
        $('input-event-from').value = todayDate.toInputValue();
        $('input-event-from-time').value = todayTime.toInputValue();
        todayTime.addTime(1, 0, 0);
        if (todayTime.date.getHours() == 0) {
            todayDate.addDate(0, 0, 1);
        }
        $('input-event-to').value = todayDate.toInputValue();
        $('input-event-to-time').value = todayTime.toInputValue();
        $('input-event-from-time').style.display = '';
        $('input-event-to-time').style.display = '';
        $('input-event-comment').value = '';
        $('checkbox-all-day').checked = false;
        $('input-event-place').value = '';
        $('checkbox-repetition').checked = false;
        $('combo-repetition-interval').style.display = 'none';
        $('href-add-remind').style.display = '';

        $('label-event-remind').style.display = 'none';

        // load reminders by default
        OnCalendarChanged(true);
    }

    popupData.previousDateFrom = new MyDate();
    popupData.previousDateFrom.setFromInputValue($('input-event-from').value);
    popupData.previousTimeFrom = new MyTime();
    popupData.previousTimeFrom.setFromInputValue($('input-event-from-time').value);
}

  /*Restores reminders in edit boxes from reminderTimeArray, reminderMethodArray*/
function RestoreReminders(reminderTimeArray, reminderMethodArray) {
    // hides all reminder divs
    for (var j=0; j< RemindersLib.REMINDER_MAX; j++) {
        $(RemindersLib.getRemindDivName(j + 1)).style.display = 'none';
    }

    if (reminderTimeArray.length > 0) {
        for (var j=0; j< reminderTimeArray.length; j++) {
            AddReminderDiv();

            // restoring reminder times
            var selectedTime = parseInt(reminderTimeArray[j]);
            var result = selectedTime;
            var resultIndex = 0;

            if (selectedTime > 0) {
                // we have reminderTimeArray values in minutes, but we want to have it in weeks/hours/days/minutes
                for (var i = 0; i < backGround.spr.reminderTimesList.items.length; i++) {
                    var k = backGround.spr.reminderTimesList.InMinutes(i);

                    var resultTmp = selectedTime / k; // we have result in hours/weeks/days

                    if (parseInt(resultTmp) == resultTmp ) { // if a value doesn`t have fraction part this value is ok
                        result = resultTmp;
                        resultIndex = i;
                    }
                }
            }

            $(RemindersLib.getRemindComboName(j+1)).selectedIndex = resultIndex;
            $(RemindersLib.getRemindInputName(j + 1)).value = result;

            var selectedMethod = TEXT_VALUE_SPLITTER + reminderMethodArray[j];
            var index = backGround.spr.reminderMethodsList.IndexOf(selectedMethod);
            $(RemindersLib.getRemindMethodComboName(j+1)).selectedIndex = index;
        }
    }
}

/* restoring last selected tab that was saved in backGround.popupSettings.lastTab*/
function RestoreLastSelectedTab(gotoDefault) {

    if (backGround.popupSettings.lastTab == -1) {
        gotoDefault();
        return;
    }

    switch (backGround.popupSettings.lastTab) {
        case popupData.windowTabs.TAB_AUTH:
            GotoAuthTab();
            break;
        case popupData.windowTabs.TAB_EVENT:
            GotoEventTab();
            break;
        case popupData.windowTabs.TAB_TASK:
            GotoTaskTab();
            break;
    }
}

/* adding event listeners to inputs*/
function AddEventHandlers() {
    // adding event handlers to tasks
    $('tab-add-task').addEventListener('click', GotoTaskTab);
    $('tab-add-event').addEventListener('click', GotoEventTab);
    $('tab-sign-in').addEventListener('click', GotoAuthTab);
    $('button-add-task').addEventListener('click', DoAddTask);
    $('button-clear-task').addEventListener('click', DoClearTask);
    $('button-sign-in').addEventListener('click', DoAuthorize);
    $('button-add-event').addEventListener('click', DoAddEvent);
    $('button-clear-event').addEventListener('click', DoClearEvent);
    $('checkbox-repetition').addEventListener('change', OnRepeatCheckChanged);
    $('checkbox-all-day').addEventListener('change', OnAllDayCheckChanged);
    // hrefs
    $('href-google-cal').addEventListener('click', OpenCalTab);
    $('href-day-by-day').addEventListener('click', OpenDayByDayTab);
    $('href-add-remind').addEventListener('click', AddReminderDiv);
    for (var i = 1; i <= RemindersLib.REMINDER_MAX; i++) {
        $(RemindersLib.getRemindHrefName(i)).addEventListener('click', CloseReminderDiv);
        $(RemindersLib.getRemindHrefName(i)).addEventListener('click', OnEventFieldChanged);
        $(RemindersLib.getRemindComboName(i)).addEventListener('change', OnEventFieldChanged);
        $(RemindersLib.getRemindMethodComboName(i)).addEventListener('change', OnEventFieldChanged);
        $(RemindersLib.getRemindInputName(i)).addEventListener('input', OnEventFieldChanged);
    }
    // input to task fields
    $('input-task-name').addEventListener('input', OnTaskFieldChanged);
    $('combo-task-list').addEventListener('change', OnTaskFieldChanged);
    $('input-task-date').addEventListener('input', OnTaskFieldChanged);
    $('checkbox-with-date').addEventListener('change', OnNoDateCheckChanged);
    $('input-task-comment').addEventListener('input', OnTaskFieldChanged);
    $('input-task-name').addEventListener("keypress", onKeypressTask, false);
    $('input-task-date').addEventListener("keypress", onKeypressTask, false);
       // input to event fields
    $('input-event-name').addEventListener('input', OnEventFieldChanged);
    $('combo-event-calendar').addEventListener('change', OnEventFieldChanged);
    $('combo-event-calendar').addEventListener('change', OnCalendarChangedCallback);
    $('input-event-from').addEventListener('input', OnEventFieldChanged);
    $('input-event-to').addEventListener('input', OnEventFieldChanged);
    $('input-event-from-time').addEventListener('input', OnEventFieldChanged);
    $('input-event-to-time').addEventListener('input', OnEventFieldChanged);
    $('input-event-comment').addEventListener('input', OnEventFieldChanged);
    $('checkbox-all-day').addEventListener('change', OnEventFieldChanged);
    $('input-event-place').addEventListener('input', OnEventFieldChanged);
    $('checkbox-repetition').addEventListener('change', OnEventFieldChanged);
    $('combo-event-calendar').addEventListener('change', OnEventFieldChanged);
    $('href-add-remind').addEventListener('click', OnEventFieldChanged);
    $('input-event-from').addEventListener('input', OnDateFromChanged);
    $('input-event-from-time').addEventListener('input', OnTimeFromChanged);
    $('input-event-name').addEventListener("keypress", onKeypressEvent, false);
    $('input-event-from').addEventListener("keypress", onKeypressEvent, false);
    $('input-event-to').addEventListener("keypress", onKeypressEvent, false);
    $('input-event-from-time').addEventListener("keypress", onKeypressEvent, false);
    $('input-event-to-time').addEventListener("keypress", onKeypressEvent, false);
    $('input-event-place').addEventListener("keypress", onKeypressEvent, false);
    chrome.runtime.onMessage.addListener(OnGotMessage);
}

/* Changes popup window state
 int newState = ST_START || ST_CONNECTED || ST_CONNECTING || ST_DISCONNECTED || ST_ERROR || ST_SUCCESS */
function changeState(newState) {
    popupData.windowStates.SetCurrentState(newState);
    backGround.LogMsg('Popup: Current state is ' + popupData.windowStates.GetCurrentState());
    UpdateCurrentState();
}

/* updates window controls according to the Popup state */
function UpdateCurrentState() {
    var currentState = popupData.windowStates.GetCurrentState();
    switch (currentState) {
        case popupData.windowStates.ST_START:
            break;
        case popupData.windowStates.ST_CONNECTED:
            disableButton($('button-sign-in'));
            SetAllElemsVisibility('visible');
            $('label-user-message').style.display='none';
            RestoreLastSelectedTab(GotoEventTab);
            setTabsVisibility(false, true, true);
            break;
        case popupData.windowStates.ST_CONNECTING:
            GotoAuthTab();
            SetAllElemsVisibility('hidden');
            ShowMessageToUser(backGround.spr.userMessages.MSG_LOADING);
            setTabsVisibility(false, false, false);
            break;
        case popupData.windowStates.ST_DISCONNECTED:
            GotoAuthTab();
            enableButton($('button-sign-in'));
            SetAllElemsVisibility('visible');
            $('label-user-message').style.display='none';
            setTabsVisibility(true, false, false);
            $('label-account-name').innerHTML = backGround.spr.userMessages.MSG_UNAUTHORIZED; // unknownUserName;
            break;
        case popupData.windowStates.ST_ERROR:
            SetAllElemsVisibility('hidden');
            ShowMessageToUser(backGround.spr.userMessages.MSG_ERROR);
            setTabsVisibility(false, false, false);
            setTimeout(function() { window.close(); }, 1500);
            break;
        case popupData.windowStates.ST_SUCCESS:
            SetAllElemsVisibility('hidden');
            ShowMessageToUser(backGround.spr.userMessages.MSG_SUCCESS);
            setTabsVisibility(false, false, false);
            setTimeout(function() { window.close(); }, 1500);
            break;
        case popupData.windowStates.ST_ASKFORMARK:
            SetAllElemsVisibility('hidden');
            ShowMessageToUser(backGround.spr.userMessages.MSG_ASKFORMARK);
            setTabsVisibility(false, false, false);
            fillTableAskForMark();
            break;
    }
}

// Shorthand for document.querySelector.
function select(selector) {
    return document.querySelector(selector);
}

// clears and asks buttons-ask-for-mark table
function clearTableAskForMark() {
    var table = select("#buttons-ask-for-mark");
    while (table.rows.length > 0) {
        table.deleteRow(table.rows.length - 1);
    }

    $('div-ask-for-name').style.display='none';
}

// fills and shows buttons-ask-for-mark table
function fillTableAskForMark() {
    $('div-ask-for-name').style.display='';
    var table = select("#buttons-ask-for-mark");

    var buttonOk = document.createElement("button");
    buttonOk.innerText = backGround.spr.userMessages.MSG_MARKOK;
    buttonOk.onclick = function(){
            backGround.LogMsg(backGround.spr.userMessages.MSG_MARKOK + ' pressed');
            backGround.trackEvent('Add mark ' + backGround.spr.userMessages.MSG_MARKOK, 'clicked');
            backGround.markCounter.stop();
            OpenTab("https://chrome.google.com/webstore/detail/day-by-day/loopacbjaigjkjdhjfkhebdhfgdmgjdc/reviews");
            setTimeout(function() { window.close(); }, 1500);
    };

    var buttonCancel = document.createElement("button");
    buttonCancel.innerText = backGround.spr.userMessages.MSG_MARKCANCEL;
    buttonCancel.onclick = function(){
            backGround.LogMsg(backGround.spr.userMessages.MSG_MARKCANCEL + ' pressed');
            backGround.trackEvent('Add mark ' + backGround.spr.userMessages.MSG_MARKCANCEL, 'clicked');
            backGround.markCounter.resetCounter();
            clearTableAskForMark();
            changeState(popupData.windowStates.ST_CONNECTED);
    };

    var row = table.insertRow(-1);
    var cell = row.insertCell(-1);
    cell.style.width = '6%';
    var cell = row.insertCell(-1);
    cell.appendChild(buttonOk);
    cell.style.width = '47%';
    cell.style.textAlign = 'center';
    buttonOk.setAttribute("class", "button-style");
    var cell = row.insertCell(-1);
    cell.style.width = '47%';
    cell.style.textAlign = 'center';
    cell.appendChild(buttonCancel);
    buttonCancel.setAttribute("class", "button-style");
}

// activates Add Tas tab
function GotoTaskTab() {
    ActivateTab('tab-add-task', 'tab-sign-in', 'tab-add-event', 'page-add-task', 'page-sign-in', 'page-add-event');
    backGround.popupSettings.lastTab = popupData.windowTabs.TAB_TASK;
}

// activates Add Event tab
function GotoEventTab() {
    ActivateTab('tab-add-event', 'tab-sign-in', 'tab-add-task', 'page-add-event', 'page-sign-in', 'page-add-task');
    backGround.popupSettings.lastTab = popupData.windowTabs.TAB_EVENT;
}

// activates Authorization tab
function GotoAuthTab() {
    ActivateTab('tab-sign-in', 'tab-add-task', 'tab-add-event', 'page-sign-in', 'page-add-task', 'page-add-event');
}

// activates tab
// string activeTabName - tab to activate name
// string passiveTabName1 - tab 1 to deactivate name
// string passiveTabName2 - tab 2 to deactivate name
// string activePageName - div to show name
 // string passivePageName1 - div 1 to hide name
 // string passivePageName2 - div 2 to hide name
function ActivateTab(activeTabName, passiveTabName1, passiveTabName2, activePageName, passivePageName1, passivePageName2) {
    $(passiveTabName1).className = 'Tab';
    $(passiveTabName2).className = 'Tab';
    $(activeTabName).className = 'SelectedTab';
    $(passivePageName1).style.display = 'none';
    $(passivePageName2).style.display = 'none';
    $(activePageName).style.display = 'block';
}

/* set Tabs visibility
 bool authVisibility - show Authorization page if true, hide page otherwise,
 bool addTaskVisibility - show Add task page if true, hide page otherwise
 bool addEventVisibility - show Add event page if true, hide page otherwise*/
function setTabsVisibility(authVisibility, addTaskVisibility, addEventVisibility) {
    $('tab-add-task').style.display = addTaskVisibility? '': 'none';
    $('tab-add-event').style.display = addEventVisibility? '': 'none';
    $('tab-sign-in').style.display = authVisibility? '': 'none';
}

/* Showing message to a user with label-user-message
 string message - message to show */
function ShowMessageToUser(message) {
    $('label-user-message').style.display='';
    $('label-user-message').innerHTML = message;
}

  // Opens the Calendar page
function OpenCalTab() {
   backGround.trackEvent('Google calendar link', 'clicked');
   OpenTab("https://www.google.com/calendar/render");
}

  // Opens the Day by Day page
function OpenDayByDayTab() {
    backGround.trackEvent('Day by day link', 'clicked');
    OpenTab("https://play.google.com/store/apps/details?id=ru.infteh.organizer.trial");
}

/*  Opens url in chrome, if it wasn`t opened, activate if it was opened
    string url - url to open */
function OpenTab(url) {
    chrome.tabs.query({url: url}, function(tabs) {
        if (tabs == null || tabs[0] == null) {
            chrome.tabs.create({url:url});
            return;
        }

        chrome.tabs.update(tabs[0].id, {active: true});
    });
}

/*  Creates an array with reminder Periods selected in combos
    returns array[string] of reminderPeriods */
function MakeReminderTimeArray() {
    var reminderTimeArray = [];

    for (var i=1; i<= RemindersLib.REMINDER_MAX; i++) {
        var div = $(RemindersLib.getRemindDivName(i));
        if (div.style.display == '') {
            var value =  parseInt($(RemindersLib.getRemindInputName(i)).value) * backGround.spr.reminderTimesList.InMinutes($(RemindersLib.getRemindComboName(i)).selectedIndex);
            reminderTimeArray.push(value);
        }
    }

    return reminderTimeArray;
}

/* Creates an array with reminder Methods selected in combos
   returns array[string] of reminderMethods */
function MakeReminderMethodArray() {
    var reminderMethodArray = [];

    for (var i=1; i<= RemindersLib.REMINDER_MAX; i++) {
        var div = $(RemindersLib.getRemindDivName(i));
        if (div.style.display == '') {
            reminderMethodArray.push(backGround.spr.reminderMethodsList.ForRequest($(RemindersLib.getRemindMethodComboName(i)).selectedIndex)); /*GetGoogleNameByValue(reminderMethods[$(RemindersLib.getRemindMethodComboName(i)).selectedIndex]));*/
        }
    }

    return reminderMethodArray;
}

/*Close reminder div event handler*/
function CloseReminderDiv(e) {
    var cnt = 0;
    var targ;

    if (!e) var e = window.event;
    if (e.target) targ = e.target;
    else if (e.srcElement) targ = e.srcElement;

    while (targ.parentNode && !targ.parentNode.getAttribute('id')) {
        targ = targ.parentNode;
    }

    var divId = targ.parentNode.getAttribute('id');

    if (divId) {
        targ.parentNode.style.display = 'none';
        $('href-add-remind').style.display = '';
    }

    for (var i=1; i<= RemindersLib.REMINDER_MAX; i++) {
        var div = $(RemindersLib.getRemindDivName(i));
        if (div.style.display == 'none') {
           cnt++;
        }
    }

    if (cnt == RemindersLib.REMINDER_MAX) {
        $('label-event-remind').style.display = 'none';
    }
}

/*Adds the reminder div with values by default*/
function AddReminderDiv() {
    var cnt = 0;

    for (var i=1; i<= RemindersLib.REMINDER_MAX; i++) {
        var div =  $(RemindersLib.getRemindDivName(i))
        if (div.style.display == 'none') {
            div.style.display = '';
            // default values
            $(RemindersLib.getRemindMethodComboName(i)).selectedIndex = 0;
            $(RemindersLib.getRemindComboName(i)).selectedIndex = 0;
            $(RemindersLib.getRemindInputName(i)).value = RemindersLib.REMINDER_DEFAULT_VALUE;
            $(RemindersLib.getRemindInputName(i)).value = RemindersLib.REMINDER_DEFAULT_VALUE;
            $('label-event-remind').style.display = '';
            cnt++;
            break;
        }
        else
            cnt++;
    }

    if (cnt == RemindersLib.REMINDER_MAX) {
        $('href-add-remind').style.display = 'none';
    }
}

// taking task lists and calendars from background
function GetGoogleInfoFromBackGround() {
    if (!backGround.loader.isLoadingTasks && backGround.loader.taskLists.length > 0) {
        popupData.taskLists = backGround.loader.taskLists;
        FillTaskListComboFromBackground();
    }

    if (!backGround.loader.isLoadingCalendars && backGround.loader.calendarLists.length > 0) {
        popupData.calendarLists = backGround.loader.calendarLists;
        FillCalendarComboFromBackground();
    }

    if (!backGround.loader.isLoadingName) {
        GetUserName();
    }
}

/* Function that is called when we get message*/
function OnGotMessage(request, sender, sendResponse) {
    if (!request.greeting) {
        return;
    }

    if (request.isOk !== undefined) {
       if (!request.isOk) {
        changeState(popupData.windowStates.ST_ERROR);
        return;
        }
       else {
           if (popupData.windowStates.GetCurrentState() == popupData.windowStates.ST_CONNECTING &&
               backGround.loader.isLoadedOk()) {
               changeState(popupData.windowStates.ST_CONNECTED);
           }
       }
    }

    backGround.LogMsg('Popup OnGotMessage ' + request.greeting);

        switch (request.greeting) {
            case "taskListReady":
                if (popupData.taskLists.length == 0) {
                    popupData.taskLists = backGround.loader.taskLists;
                    FillTaskListComboFromBackground();
                }
                break;
            case "calendarListReady":
                if (popupData.calendarLists.length == 0) {
                    popupData.calendarLists = backGround.loader.calendarLists;
                    FillCalendarComboFromBackground();
                }
                break;
            case "userNameReady":
                GetUserName();
                break;
            case "AddedOk":
                if (request.type == "task") {
                    backGround.popupSettings.ClearSavedTask();
                    popupData.addingTaskInProcess = false;
                    SetButtonAddTaskState();
                 }

                if (request.type == "event") {
                    backGround.popupSettings.ClearSavedEvent();
                    popupData.addingEventInProcess = false;
                    SetButtonAddEventState();
                }

                backGround.markCounter.addToCurr(1);
                changeState(popupData.windowStates.ST_SUCCESS);
                break;
            case "AddedError":
                if (request.type == "task") {
                    popupData.addingTaskInProcess = false;
                    SetButtonAddTaskState();
                 }

                if (request.type == "event") {
                    popupData.addingEventInProcess = false;
                    SetButtonAddEventState();
                }

                alert(backGround.spr.userMessages.MSG_ERROR + '\n' + request.error);
                break;
        }
    }

/*fills combo with calendars*/
function FillCalendarComboFromBackground() {
    var combo = $('combo-event-calendar');
    combo.options.length = 0;

    for (var i = 0, cal; cal = popupData.calendarLists[i]; i++)
    {
        if (cal.accessRole == "owner") {
            var option = document.createElement("option");
            option.innerHTML = cal.summary;
            option.style.color = cal.backgroundColor;

            combo.add(option,combo[0]);
        }
    }

    RestoreEventInProcessCombo();
}

  /*restores combo calendar value from eventInProcess or lastSelectedCalendar*/
function RestoreEventInProcessCombo() {
    var index = -1;

    if (backGround.popupSettings.SavedEventExists()) {
        var eventInProcess = backGround.popupSettings.GetSavedEvent();
        index = popupData.SearchCalendarIndexById(eventInProcess.listId );
        if (index != -1) {
            $('combo-event-calendar').value = eventInProcess.listName;
        }

        OnCalendarChanged(false);
    }
    else if (backGround.popupSettings.lastSelectedCalendar) {
        index = popupData.SearchCalendarIndexById(backGround.popupSettings.lastSelectedCalendar);
        if (index != -1) {
            $('combo-event-calendar').value = popupData.calendarLists[index].summary;
        }

        OnCalendarChanged(true);
    }
    else {
        OnCalendarChanged(true);
    }
}

/*fills combo with task lists*/
function FillTaskListComboFromBackground() {

    var combo = $('combo-task-list');
    combo.options.length = 0;

    for (var i = 0, cal; cal = popupData.taskLists[i]; i++)
    {
        var option = document.createElement("option");
        option.text = cal.title;
        combo.add(option,combo[0]);
    }

    RestoreTaskInProcessCombo();
}

/*restores combo task list from taskInProcess or lastSelectedTaskList*/
function RestoreTaskInProcessCombo() {
    var index = -1;
    if (backGround.popupSettings.SavedTaskExists()) {
        var taskInProcess = backGround.popupSettings.GetSavedTask();
        index = popupData.SearchTaskListIndexById(taskInProcess.listId );
        if (index != -1) {
            $('combo-task-list').value = taskInProcess.listName;
        }
    }
    else if (backGround.popupSettings.lastSelectedTaskList) {
        index = popupData.SearchTaskListIndexById(backGround.popupSettings.lastSelectedTaskList);
        if (index != -1) {
            $('combo-task-list').value = popupData.taskLists[index].title;
        }
    }
}

/*fills label-account-name with it*/
function GetUserName() {
    backGround.LogMsg('Popup: GotUserName!');
    $('label-account-name').innerHTML = backGround.loader.userName != null ?  backGround.loader.userName : backGround.spr.userMessages.MSG_UNAUTHORIZED;
}

  /*Add task action*/
function DoAddTask() {
    if (!AreAllTaskfieldsValid()) {
        return;
    }

    if (popupData.addingTaskInProcess) {
        return;
    }

    popupData.addingTaskInProcess = true;
    SetButtonAddTaskState();

    backGround.LogMsg('Popup: Add Task Called');
    backGround.trackEvent('Add a task', 'clicked');

    var name = $('input-task-name').value;
    var listName = $('combo-task-list').value;
    var listId = popupData.getTaskIdByName(listName);
    var date = null;
    if ($('checkbox-with-date').checked) {
        date = new MyDate();
        date.setFromInputValue( $('input-task-date').value);
    }

    var notes = $('input-task-comment').value;

  //  backGround.loader.addTask(name, listId, date,  notes);
    backGround.loader.addTask({"name": name, "listId": listId, "date": date, "notes": notes});
}

  /*Discard task action*/
function DoClearTask() {
   backGround.popupSettings.ClearSavedTask();
   RestoreTaskInProcess();
   SetButtonAddTaskState();
}

  /*Discard event action*/
function DoClearEvent() {
    backGround.popupSettings.ClearSavedEvent();
    RestoreEventInProcess();
    SetButtonAddEventState();
}

  /*Add event action*/
function DoAddEvent() {
    document.getElementById('input-event-from-time').value = addCurrentTime();
    if (!AreAllEventFieldsValid()) {
        return;
    }

    if (popupData.addingEventInProcess) {
        return;
    }

    popupData.addingEventInProcess = true;
    SetButtonAddEventState();
    
    backGround.LogMsg('Popup: Add Event Called');
    backGround.trackEvent('Add an event', 'clicked');

    var name = $('input-event-name').value;
    var listName = $('combo-event-calendar').value;
    var listId = popupData.getCalendarIdByName(listName);
    var timeZone = popupData.getTimeZoneByName(listName);
    var dateStart = new MyDate();
    dateStart.setFromInputValue($('input-event-from').value);
    var dateEnd = new MyDate();
    dateEnd.setFromInputValue($('input-event-to').value);
    var timeStart = new MyTime();
    timeStart.setFromInputValue($('input-event-from-time').value);
    var timeEnd = new MyTime();
    timeEnd.setFromInputValue($('input-event-to-time').value);
    var description = $('input-event-comment').value;
    var allDay = $('checkbox-all-day').checked;
    var place = $('input-event-place').value;
    var recurrenceTypeIndex = $('checkbox-repetition').checked? $('combo-repetition-interval').selectedIndex : -1;
    var recurrenceTypeValue = recurrenceTypeIndex  > -1 ? backGround.spr.repetitionPeriodList.items[recurrenceTypeIndex] : null;

    var reminderTimeArray = MakeReminderTimeArray();
    var reminderMethodArray = MakeReminderMethodArray();

 //   backGround.loader.addEvent(name, listId, timeZone, dateStart, dateEnd, timeStart, timeEnd, description, allDay, place, recurrenceTypeValue, reminderTimeArray, reminderMethodArray);
    backGround.loader.addEvent({"name": name, "listId": listId, "timeZone": timeZone, "dateStart": dateStart, "dateEnd": dateEnd,
        "timeStart": timeStart, "timeEnd": timeEnd, "description": description, "allDay": allDay,
        "place": place, "recurrenceTypeValue": recurrenceTypeValue, "reminderTimeArray": reminderTimeArray,
        "reminderMethodArray": reminderMethodArray});
}

/* Authorization action*/
function DoAuthorize() {
    backGround.LogMsg('Popup: Authorize called');
    changeState(popupData.windowStates.ST_CONNECTING);
    backGround.loader.Load(true);
}

// Hides or shows all page elements
// string visibility = 'visible' || 'hidden'
function SetAllElemsVisibility(visibility) {
    $('page-add-task').style.visibility = visibility;
    $('page-add-event').style.display = visibility == 'visible'? '':'none';
    $('page-sign-in').style.visibility = visibility;
    $('href-google-cal').style.display = visibility == 'visible'? '':'none';
    $('href-day-by-day').style.display = visibility == 'visible'? '': 'none';
}

/*localize page to current language*/
function LocalizePage() {
        // tabs
    $('href-sign-in').innerHTML =
        chrome.i18n.getMessage('authorize_tab_title');
    $('href-add-task').innerHTML =
        chrome.i18n.getMessage('add_task_tab_title');
    $('href-add-event').innerHTML =
        chrome.i18n.getMessage('add_event_tab_title');

    // hrefs
    $('href-google-cal').innerHTML =
        chrome.i18n.getMessage('calendar_link_title');
    $('href-day-by-day-big').innerHTML =
        chrome.i18n.getMessage('day_by_day_link_title_big');
    $('href-day-by-day-small').innerHTML =
        chrome.i18n.getMessage('day_by_day_link_title_small');
    
    // tasks
    $('input-task-name').placeholder =
        chrome.i18n.getMessage('task_name_title');
    $('label-task-list').innerHTML =
        chrome.i18n.getMessage('task_list_title');

    $('label-task-date').innerHTML =
        chrome.i18n.getMessage('task_date_title');
    $('input-task-comment').placeholder =
        chrome.i18n.getMessage('task_comment_title');
    $('button-add-task').value =
        chrome.i18n.getMessage('add_task_action_title');
    $('button-clear-task').value =
        chrome.i18n.getMessage('clear_task_action_title');

    // authorization
    $('button-sign-in').value =
        chrome.i18n.getMessage('authorize_tab_title');

    // event
    $('input-event-name').placeholder =
        chrome.i18n.getMessage('event_name');
    $('label-event-from').innerHTML =
        chrome.i18n.getMessage('event_start_date_title');
    $('label-event-to').innerHTML =
        chrome.i18n.getMessage('event_end_date_title');
    $('label-repetition').innerHTML =
        chrome.i18n.getMessage('repetition_is_checked');
    $('label-all-day').innerHTML =
        chrome.i18n.getMessage('all_day_is_checked');
    $('label-repetition-interval').innerHTML =
        chrome.i18n.getMessage('repetition_interval_title');
    $('input-event-comment').placeholder =
        chrome.i18n.getMessage('event_description_title');
    $('input-event-place').placeholder =
        chrome.i18n.getMessage('event_place_title');
    $('label-event-calendar').innerHTML=
        chrome.i18n.getMessage('event_calendar_title');
    $('button-add-event').value =
        chrome.i18n.getMessage('add_event_action_title');
    $('button-clear-event').value =
        chrome.i18n.getMessage('clear_event_action_title');

    $('label-event-remind').innerHTML =
        chrome.i18n.getMessage('reminder_title');
    $('href-add-remind').innerHTML =
        chrome.i18n.getMessage('reminder_add_action_title');
}

/* Enables button button-add-task if task fields are valid */
function SetButtonAddTaskState() {
    if (AreAllTaskfieldsValid())
        enableButton($('button-add-task'));
    else
        disableButton($('button-add-task'));
}

/* Enables button button-add-event if event fields are valid*/
function SetButtonAddEventState() {
    if (AreAllEventFieldsValid())
        enableButton($('button-add-event'));
    else
        disableButton($('button-add-event'));
}

/*  DateFrom change event handler
    When Date From is changed, date To should change to the same distance
    Example: Date From 16.06.2014 Date To 18.06.2014
    DateFrom Changes to 20.06.2014
    Date To should be 22.06.2014 */
function OnDateFromChanged() {
    if ($('input-event-from').checkValidity()) {
        var days = popupData.previousDateFrom.subDate($('input-event-from').value);
        var myDateTmp = new MyDate();
        myDateTmp.setFromInputValue( $('input-event-to').value);
        myDateTmp.addDate(0, 0, -1 * days);
        $('input-event-to').value = myDateTmp.toInputValue();
        popupData.previousDateFrom.setFromInputValue($('input-event-from').value);
    }
}

/*  TimeFrom change event handler
    When time from is changed time Time To should change to the same distance */
function OnTimeFromChanged() {
    if ($('input-event-from-time').checkValidity()) {
        var minutes = popupData.previousTimeFrom.subTime($('input-event-from-time').value);
        var myTimeTmp = new MyTime();
        myTimeTmp.setFromInputValue( $('input-event-to-time').value);
        myTimeTmp.addTime(0, -1 * minutes, 0);
        $('input-event-to-time').value = myTimeTmp.toInputValue();
        popupData.previousTimeFrom.setFromInputValue($('input-event-from-time').value);
    }
}

/* Returns true if all task fields are valid, false otherwise*/
function AreAllTaskfieldsValid() {
    var taskDateIsValid = $('input-task-date').checkValidity() || !($('checkbox-with-date').checked);
    return  ($('input-task-name').checkValidity() && $('combo-task-list').checkValidity() && taskDateIsValid && !popupData.addingTaskInProcess);
}

/* Returns true if all event fields are valid, false otherwise*/
function AreAllEventFieldsValid() {
    var remindersOk = true;

    for (var i=1; i<= RemindersLib.REMINDER_MAX; i++) {
        remindersOk = remindersOk && ($(RemindersLib.getRemindDivName(i)).style.display == 'none' || $(RemindersLib.getRemindInputName(i)).checkValidity());
    }

    return  ($('input-event-name').checkValidity() && $('input-event-from').checkValidity() &&
         $('input-event-to').checkValidity() && $('combo-event-calendar').checkValidity() &&
         $('input-event-from-time').checkValidity() && $('input-event-to-time').checkValidity() &&
        remindersOk && !popupData.addingEventInProcess);
}

/*  Repeat checkbox event handler
    Shows combo-repetition-interval if checkbox is checked, hides otherwise*/
function OnRepeatCheckChanged () {
    $('combo-repetition-interval').style.display = $('checkbox-repetition').checked ? '': 'none';
}

/*  No date checkbox event handler
    Hides input-task-date if checkbox not checked, shows otherwise */
function OnNoDateCheckChanged() {
    $('input-task-date').style.display = $('checkbox-with-date').checked ? '' : 'none';
    var taskInProcess = backGround.popupSettings.GetSavedTask();
    taskInProcess.date = $('checkbox-with-date').checked ?  $('input-task-date').value : null;

    SetButtonAddTaskState();
}

/*Every modification of task fields creates taskInProcess and checks if button should be enabled*/
function OnTaskFieldChanged(e) {
    backGround.popupSettings.GetSavedTask();
    SetButtonAddTaskState();
}

/*Every modification of event fields creates eventInProcess and checks if button should be enabled*/
function OnEventFieldChanged(e) {
    backGround.popupSettings.GetSavedEvent();
    SetButtonAddEventState();
}

/* Sets calendar`s color*/
function OnCalendarChangedCallback() {
    OnCalendarChanged(false);
}

  /* Sets color of selected in combo calendar
  * bool restoreRemiders - if true we should restore default reminders for selected calendar, otherwise - do nothing*/
function OnCalendarChanged(restoreReminders) {
    var combo = $('combo-event-calendar');
    for (var i=0; i < combo.options.length; i++) {
        if (combo.value == combo.options[i].value) {
            $('td-color-calendar').style.backgroundColor = combo.options[i].style.color;

            if (restoreReminders) {
                var reminderTimeArray =  [];
                var reminderTimeMethod = [];

                popupData.getDefaultRemindersByName(combo.value, reminderTimeArray, reminderTimeMethod);
                RestoreReminders(reminderTimeArray, reminderTimeMethod);
            }

            break;
        }
    }
}

/*  All Day checkbox event handler
    Hides time inputs if checked, shows otherwise */
function OnAllDayCheckChanged() {
    $('input-event-from-time').style.display = $('checkbox-all-day').checked ? 'none': '';
    $('input-event-to-time').style.display = $('checkbox-all-day').checked ? 'none': '';
}

  /*Pressing Enter on every field (but not Comment) should call DoAddTask*/
function onKeypressTask(event) {
    var keyCode = event.keyCode;

    if (keyCode == 13 && AreAllTaskfieldsValid()) {
        DoAddTask();
    }
}

  /*Pressing Enter on every field (but not Description) should call DoAddEvent*/
function onKeypressEvent(event) {
    var keyCode = event.keyCode;

    if (keyCode == 13 && AreAllEventFieldsValid()) {
        DoAddEvent();
    }
}

  // Exeption should be saved n Google Analytics
window.onerror = function(message, file, line) {
    backGround._gaq.push(['_trackEvent', "Global", "Exception", file + "(" + line + "): " + message])
};


Date.prototype.toDateInputValue = (function() {
    var local = new Date(this);
    local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
    return local.toJSON().slice(0,10);
});

function addCurrentTime(){
    

    var d = new Date();      
      h = d.getHours(),
      m = d.getMinutes();
      if(h < 10) h = '0' + h; 
      if(m < 10) m = '0' + m;
      return h + ':' + m;
}

function testfunction(){
    var test=document.getElementById("dropbtn");
    if(test.selectedIndex!=0){
        document.getElementById("input-event-name").value="#"+test.value

        
        
        document.getElementById('input-event-from-time').value = addCurrentTime();
        document.getElementById('input-event-from').value = new Date().toDateInputValue();
        document.getElementById('input-event-to').value = new Date().toDateInputValue();
        document.getElementById('input-event-from-time').disabled=true;
    }
    
    document.getElementById("dropbtn").selectedIndex=0;
   
    

}


