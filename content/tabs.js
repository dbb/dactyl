/***** BEGIN LICENSE BLOCK ***** {{{
Version: MPL 1.1/GPL 2.0/LGPL 2.1

The contents of this file are subject to the Mozilla Public License Version
1.1 (the "License"); you may not use this file except in compliance with
the License. You may obtain a copy of the License at
http://www.mozilla.org/MPL/

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
for the specific language governing rights and limitations under the
License.

(c) 2006-2008: Martin Stubenschrott <stubenschrott@gmx.net>

Alternatively, the contents of this file may be used under the terms of
either the GNU General Public License Version 2 or later (the "GPL"), or
the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
in which case the provisions of the GPL or the LGPL are applicable instead
of those above. If you wish to allow use of your version of this file only
under the terms of either the GPL or the LGPL, and not to allow others to
use your version of this file under the terms of the MPL, indicate your
decision by deleting the provisions above and replace them with the notice
and other provisions required by the GPL or the LGPL. If you do not delete
the provisions above, a recipient may use your version of this file under
the terms of any one of the MPL, the GPL or the LGPL.
}}} ***** END LICENSE BLOCK *****/

/**
 * provides functions for working with tabs
 * XXX: ATTENTION: We are planning to move to the FUEL API once we switch to
 * Firefox 3.0, then this class should go away and their tab methods should be used
 * @deprecated
 */
vimperator.Tabs = function () //{{{
{
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////// PRIVATE SECTION /////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{
    var alternates = [getBrowser().mCurrentTab, null];

    // @param spec can either be:
    // - an absolute integer
    // - "" for the current tab
    // - "+1" for the next tab
    // - "-3" for the tab, which is 3 positions left of the current
    // - "$" for the last tab
    function indexFromSpec(spec, wrap)
    {
        var position = getBrowser().mTabContainer.selectedIndex;
        var length   = getBrowser().mTabs.length;
        var last     = length - 1;

        if (spec === undefined || spec === "")
            return position;

        if (typeof spec === "number")
            position = spec;
        else if (spec === "$")
            position = last;
        else if (/^[+-]\d+$/.test(spec))
            position += parseInt(spec, 10);
        else if (/^\d+$/.test(spec))
            position = parseInt(spec, 10);
        else
            return -1;

        if (position > last)
            position = wrap ? position % length : last;
        else if (position < 0)
            position = wrap ? (position % length) + length : 0;

        return position;
    }

    // hide tabs initially
    getBrowser().mStrip.getElementsByClassName("tabbrowser-tabs")[0].collapsed = true;

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// OPTIONS /////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    vimperator.options.add(["activate", "act"],
        "Define when tabs are automatically activated",
        "stringlist", "homepage,quickmark,tabopen,paste",
        {
            validator: function (value)
            {
                return value.split(",").every(function (item) { return /^(homepage|quickmark|tabopen|paste|)$/.test(item); });
            }
        });
    vimperator.options.add(["popups", "pps"],
        "Where to show requested popup windows",
        "number", 1,
        {
            setter: function (value)
            {
                var values = [[0, 1], // always in current tab
                              [0, 3], // in a new tab
                              [2, 3], // in a new window if it has specified sizes
                              [1, 2]];// always in new window
                vimperator.options.setPref("browser.link.open_newwindow.restriction", values[value][0]);
                vimperator.options.setPref("browser.link.open_newwindow", values[value][1]);
            },
            validator: function (value) { return (value >= 0 && value <= 3); }
        });
    vimperator.options.add(["showtabline", "stal"], 
        "Control when to show the tab bar of opened web pages",
        "number", 2,
        {
            setter: function (value)
            {
                var tabs = getBrowser().mStrip.getElementsByClassName("tabbrowser-tabs")[0];
                if (!tabs)
                    return;

                if (value == 0)
                {
                    tabs.collapsed = true;
                }
                else if (value == 1)
                {
                    vimperator.options.setPref("browser.tabs.autoHide", true);
                    tabs.collapsed = false;
                }
                else
                {
                    vimperator.options.setPref("browser.tabs.autoHide", false);
                    tabs.collapsed = false;
                }
            },
            validator: function (value) { return (value >= 0 && value <= 2); }
        });


    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// PUBLIC SECTION //////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    return {

        get alternate() { return alternates[1]; },

        get count() { return getBrowser().mTabs.length; },

        // @returns the index of the currently selected tab starting with 0
        index: function (tab)
        {
            if (tab)
            {
                var length = getBrowser().mTabs.length;
                for (var i = 0; i < length; i++)
                {
                    if (getBrowser().mTabs[i] == tab)
                        return i;
                }
                return -1;
            }

            return getBrowser().mTabContainer.selectedIndex;
        },

        // TODO: implement filter
        // @returns an array of tabs which match filter
        get: function (filter)
        {
            var buffers = [];
            var browsers = getBrowser().browsers;
            for (var i in browsers)
            {
                var title = browsers[i].contentTitle || "(Untitled)";
                var uri = browsers[i].currentURI.spec;
                var number = i + 1;
                buffers.push([number, title, uri]);
            }
            return buffers;
        },

        getTab: function (index)
        {
            if (index)
                return getBrowser().mTabs[index];

            return getBrowser().mTabContainer.selectedItem;
        },

        // wrap causes the movement to wrap around the start and end of the tab list
        // NOTE: position is a 0 based index
        move: function (tab, spec, wrap)
        {
            var index = indexFromSpec(spec, wrap);
            getBrowser().moveTabTo(tab, index);
        },

        // quitOnLastTab = 1: quit without saving session
        // quitOnLastTab = 2: quit and save session
        remove: function (tab, count, focusLeftTab, quitOnLastTab)
        {
            function removeOrBlankTab (tab)
            {
                if (getBrowser().mTabs.length > 1)
                    getBrowser().removeTab(tab);
                else
                {
                    if (vimperator.buffer.URL != "about:blank" ||
                        getWebNavigation().sessionHistory.count > 0)
                    {
                        vimperator.open("about:blank", vimperator.NEW_BACKGROUND_TAB);
                        getBrowser().removeTab(tab);
                    }
                    else
                        vimperator.beep();
                }
            }

            if (count < 1)
                count = 1;

            if (quitOnLastTab >= 1 && getBrowser().mTabs.length <= count)
            {
                if (vimperator.windows.length > 1)
                    window.close();
                else
                    vimperator.quit(quitOnLastTab == 2);

                return;
            }

            var index = this.index(tab);
            if (focusLeftTab)
            {
                var lastRemovedTab = 0;
                for (var i = index; i > index - count && i >= 0; i--)
                {
                    removeOrBlankTab(this.getTab(i));
                    lastRemovedTab = i > 0 ? i : 1;
                }
                getBrowser().mTabContainer.selectedIndex = lastRemovedTab - 1;
            }
            else
            {
                var i = index + count - 1;
                if (i >= this.count)
                    i = this.count - 1;

                for (; i >= index; i--)
                    removeOrBlankTab(this.getTab(i));
            }
        },

        keepOnly: function (tab)
        {
            getBrowser().removeAllTabsBut(tab);
        },

        select: function (spec, wrap)
        {
            var index = indexFromSpec(spec, wrap);
            // FIXME:
            if (index === -1)
            {
                vimperator.beep(); // XXX: move to ex-handling?
                return;
            }
            getBrowser().mTabContainer.selectedIndex = index;
        },

        // TODO: when restarting a session FF selects the first tab and then the
        // tab that was selected when the session was created.  As a result the
        // alternate after a restart is often incorrectly tab 1 when there
        // shouldn't be one yet.
        updateSelectionHistory: function ()
        {
            alternates = [this.getTab(), alternates[0]];
        },

        reload: function (tab, bypassCache)
        {
            if (bypassCache)
            {
                const nsIWebNavigation = Components.interfaces.nsIWebNavigation;
                const flags = nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY | nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE;
                getBrowser().getBrowserForTab(tab).reloadWithFlags(flags);
            }
            else
            {
                getBrowser().reloadTab(tab);
            }
        },

        reloadAll: function (bypassCache)
        {
            if (bypassCache)
            {
                for (var i = 0; i < getBrowser().mTabs.length; i++)
                {
                    try
                    {
                        this.reload(getBrowser().mTabs[i], bypassCache);
                    }
                    catch (e)
                    {
                        // FIXME: can we do anything useful here without stopping the
                        //        other tabs from reloading?
                    }
                }
            }
            else
            {
                getBrowser().reloadAllTabs();
            }
        }

    };
    //}}}
}; //}}}

// vim: set fdm=marker sw=4 ts=4 et:
