define(["appSettings", "loading", "apphost", "iapManager", "events", "shell", "globalize", "dialogHelper", "connectionManager", "layoutManager", "emby-button", "emby-linkbutton"], function(appSettings, loading, appHost, iapManager, events, shell, globalize, dialogHelper, connectionManager, layoutManager) {
    "use strict";

    function alertText(options) {
        return new Promise(function(resolve, reject) {
            require(["alert"], function(alert) {
                alert(options).then(resolve, reject)
            })
        })
    }

    function showInAppPurchaseInfo(subscriptionOptions, unlockableProductInfo, dialogOptions) {
        return new Promise(function(resolve, reject) {
            require(["listViewStyle", "formDialogStyle"], function() {
                showInAppPurchaseElement(subscriptionOptions, unlockableProductInfo, dialogOptions, resolve, reject), currentDisplayingResolve = resolve
            })
        })
    }

    function showPeriodicMessage(feature, settingsKey) {
        return new Promise(function(resolve, reject) {
            require(["listViewStyle", "emby-button", "formDialogStyle"], function() {
                var dlg = dialogHelper.createDialog({
                    size: layoutManager.tv ? "fullscreen" : "fullscreen-border",
                    removeOnClose: !0,
                    scrollY: !1
                });
                dlg.classList.add("formDialog");
                var html = "";
                var seconds = 11;
                html += '<div class="continueTimeText formDialogFooterItem" style="margin: 1.5em 0 .5em;">' + globalize.translate("sharedcomponents#ContinueInSecondsValue", seconds) + "</div>", html += '<button is="emby-button" type="button" class="raised button-cancel block btnContinue block formDialogFooterItem hide"><span>' + globalize.translate("sharedcomponents#Continue") + "</span></button>", html += "</div>", html += "</div>", html += "</div>", dlg.innerHTML = html;
                var i, length, isRejected = !0,
                    timeTextInterval = setInterval(function() {
                        seconds -= 1, seconds <= 0 ? (dlg.querySelector(".continueTimeText").classList.add("hide"), dlg.querySelector(".btnContinue").classList.remove("hide")) : dlg.querySelector(".continueTimeText").innerHTML = globalize.translate("sharedcomponents#ContinueInSecondsValue", seconds)
                    }, 1e3),
                    btnPurchases = dlg.querySelectorAll(".buttonPremiereInfo");
                for (i = 0, length = btnPurchases.length; i < length; i++) btnPurchases[i].addEventListener("click", showExternalPremiereInfo);
                layoutManager.tv && centerFocus(dlg.querySelector(".formDialogContent"), !1, !0), dlg.addEventListener("close", function(e) {
                    clearInterval(timeTextInterval), layoutManager.tv && centerFocus(dlg.querySelector(".formDialogContent"), !1, !1), isRejected ? reject() : (appSettings.set(settingsKey, (new Date).getTime()), resolve())
                }), dlg.querySelector(".btnContinue").addEventListener("click", function() {
                    isRejected = !1, dialogHelper.close(dlg)
                }), dlg.querySelector(".btnGetPremiere").addEventListener("click", showPremiereInfo), dialogHelper.open(dlg);
                var onCancelClick = function() {
                        dialogHelper.close(dlg)
                    },
                    elems = dlg.querySelectorAll(".btnCancelSupporterInfo");
                for (i = 0, length = elems.length; i < length; i++) elems[i].addEventListener("click", onCancelClick)
            })
        })
    }

    function showPeriodicMessageIfNeeded(feature) {
        if ("playback" !== feature) return Promise.resolve();
        var intervalMs = iapManager.getPeriodicMessageIntervalMs(feature);
        if (intervalMs <= 0) return Promise.resolve();
        var settingsKey = "periodicmessage11-" + feature,
            lastMessage = parseInt(appSettings.get(settingsKey) || "0");
        if (!lastMessage) return appSettings.set(settingsKey, (new Date).getTime()), Promise.resolve();
        if ((new Date).getTime() - lastMessage > intervalMs) {
            var apiClient = connectionManager.currentApiClient();
            if ("6da60dd6edfc4508bca2c434d4400816" === apiClient.serverId()) return Promise.resolve();
            var registrationOptions = {
                viewOnly: !0
            };
            return connectionManager.getRegistrationInfo(iapManager.getAdminFeatureName(feature), apiClient, registrationOptions).catch(function(errorResult) {
                return "overlimit" === errorResult ? (appSettings.set(settingsKey, (new Date).getTime()), Promise.resolve()) : showPeriodicMessage(feature, settingsKey)
            })
        }
        return Promise.resolve()
    }

    function validateFeature(feature, options) {
        return options = options || {}, console.log("validateFeature: " + feature), iapManager.isUnlockedByDefault(feature, options).then(function() {
            return showPeriodicMessageIfNeeded(feature)
        }, function() {
            var unlockableFeatureCacheKey = "featurepurchased-" + feature;
            if ("1" === appSettings.get(unlockableFeatureCacheKey)) return showPeriodicMessageIfNeeded(feature);
            var unlockableProduct = iapManager.getProductInfo(feature);
            if (unlockableProduct) {
                var unlockableCacheKey = "productpurchased-" + unlockableProduct.id;
                if (unlockableProduct.owned) return appSettings.set(unlockableFeatureCacheKey, "1"), appSettings.set(unlockableCacheKey, "1"), showPeriodicMessageIfNeeded(feature);
                if ("1" === appSettings.get(unlockableCacheKey)) return showPeriodicMessageIfNeeded(feature)
            }
            var unlockableProductInfo = unlockableProduct ? {
                enableAppUnlock: !0,
                id: unlockableProduct.id,
                price: unlockableProduct.price,
                feature: feature
            } : null;
            return iapManager.getSubscriptionOptions().then(function(subscriptionOptions) {
                if (subscriptionOptions.filter(function(p) {
                        return p.owned
                    }).length > 0) return Promise.resolve();
                var registrationOptions = {
                    viewOnly: options.viewOnly
                };
                return connectionManager.getRegistrationInfo(iapManager.getAdminFeatureName(feature), connectionManager.currentApiClient(), registrationOptions).catch(function(errorResult) {
                    if (!1 === options.showDialog) return Promise.reject();
                    var alertPromise;
                    return "overlimit" === errorResult && (alertPromise = showOverLimitAlert()), alertPromise || (alertPromise = Promise.resolve()), alertPromise.then(function() {
                        var dialogOptions = {
                            title: globalize.translate("sharedcomponents#HeaderUnlockFeature"),
                            feature: feature
                        };
                        return currentValidatingFeature = feature, showInAppPurchaseInfo(subscriptionOptions, unlockableProductInfo, dialogOptions)
                    })
                })
            })
        })
    }

    function showOverLimitAlert() {
        return alertText("Your Jellyfin Premiere device limit has been exceeded. Please check with the owner of your Jellyfin Server and have them contact Jellyfin support at apps@emby.media if necessary.").catch(function() {
            return Promise.resolve()
        })
    }

    function cancelInAppPurchase() {
        var elem = document.querySelector(".inAppPurchaseOverlay");
        elem && dialogHelper.close(elem)
    }

    function clearCurrentDisplayingInfo() {
        currentDisplayingProductInfos = [], currentDisplayingResolve = null, currentValidatingFeature = null, isCurrentDialogRejected = null
    }

    function showExternalPremiereInfo() {
        shell.openUrl(iapManager.getPremiumInfoUrl())
    }

    function centerFocus(elem, horiz, on) {
        require(["scrollHelper"], function(scrollHelper) {
            var fn = on ? "on" : "off";
            scrollHelper.centerFocus[fn](elem, horiz)
        })
    }

    function getPurchaseTermHtml(term) {
        return "<li>" + term + "</li>"
    }

    function getTermsOfPurchaseHtml() {
        var html = "",
            termsOfPurchase = iapManager.getTermsOfPurchase ? iapManager.getTermsOfPurchase() : [];
        return termsOfPurchase.length ? (html += "<h1>" + globalize.translate("sharedcomponents#HeaderTermsOfPurchase") + "</h1>", termsOfPurchase.push('<a is="emby-linkbutton" class="button-link" href="https://github.com/jellyfin/jellyfin" target="_blank">' + globalize.translate("sharedcomponents#PrivacyPolicy") + "</a>"), termsOfPurchase.push('<a is="emby-linkbutton" class="button-link" href="https://github.com/jellyfin/jellyfin" target="_blank">' + globalize.translate("sharedcomponents#TermsOfUse") + "</a>"), html += "<ul>", html += termsOfPurchase.map(getPurchaseTermHtml).join(""), html += "</ul>") : html
    }

    function showInAppPurchaseElement(subscriptionOptions, unlockableProductInfo, dialogOptions, resolve, reject) {
        function onCloseButtonClick() {
            dialogHelper.close(dlg)
        }
        cancelInAppPurchase(), currentDisplayingProductInfos = subscriptionOptions.slice(0), unlockableProductInfo && currentDisplayingProductInfos.push(unlockableProductInfo);
        var dlg = dialogHelper.createDialog({
            size: layoutManager.tv ? "fullscreen" : "fullscreen-border",
            removeOnClose: !0,
            scrollY: !1
        });
        dlg.classList.add("formDialog");
        var html = "";
        html += '<div class="formDialogHeader">', html += '<button is="paper-icon-button-light" class="btnCloseDialog autoSize" tabindex="-1"><i class="md-icon">&#xE5C4;</i></button>', html += '<h3 class="formDialogHeaderTitle">', html += dialogOptions.title || "", html += "</h3>", html += "</div>", html += '<div class="formDialogContent smoothScrollY">', html += '<div class="dialogContentInner dialog-content-centered">', html += '<form style="margin:auto;">', html += '<p style="margin-top:1.5em;">', html += unlockableProductInfo ? globalize.translate("sharedcomponents#MessageUnlockAppWithPurchaseOrSupporter") : globalize.translate("sharedcomponents#MessageUnlockAppWithSupporter"), html += "</p>", html += '<p style="margin:1.5em 0 2em;">', html += globalize.translate("sharedcomponents#MessageToValidateSupporter"), html += "</p>";
        var i, length;
        for (i = 0, length = subscriptionOptions.length; i < length; i++) !0, html += "<p>", html += '<button is="emby-button" type="button" class="raised button-submit block btnPurchase" data-email="' + (!1 !== subscriptionOptions[i].requiresEmail) + '" data-featureid="' + subscriptionOptions[i].id + '"><span>', html += subscriptionOptions[i].title, html += "</span></button>", html += "</p>";
        if (unlockableProductInfo) {
            !0;
            var unlockText = globalize.translate("sharedcomponents#ButtonUnlockWithPurchase");
            unlockableProductInfo.price && (unlockText = globalize.translate("sharedcomponents#ButtonUnlockPrice", unlockableProductInfo.price)), html += "<p>", html += '<button is="emby-button" type="button" class="raised secondary block btnPurchase" data-featureid="' + unlockableProductInfo.id + '"><span>' + unlockText + "</span></button>", html += "</p>"
        }
        html += "<p>", html += '<button is="emby-button" type="button" class="raised button-cancel block btnRestorePurchase"><span>' + iapManager.getRestoreButtonText() + "</span></button>", html += "</p>", subscriptionOptions.length && (html += '<h1 style="margin-top:1.5em;">' + globalize.translate("sharedcomponents#HeaderBenefitsJellyfinPremiere") + "</h1>", html += '<div class="paperList" style="margin-bottom:1em;">', html += getSubscriptionBenefits().map(getSubscriptionBenefitHtml).join(""), html += "</div>"), "playback" === dialogOptions.feature && (html += "<p>", html += '<button is="emby-button" type="button" class="raised button-cancel block btnPlayMinute"><span>' + globalize.translate("sharedcomponents#ButtonPlayOneMinute") + "</span></button>", html += "</p>"), html += getTermsOfPurchaseHtml(), html += "</form>", html += "</div>", html += "</div>", dlg.innerHTML = html, document.body.appendChild(dlg);
        var btnPurchases = dlg.querySelectorAll(".btnPurchase");
        for (i = 0, length = btnPurchases.length; i < length; i++) btnPurchases[i].addEventListener("click", onPurchaseButtonClick);
        for (btnPurchases = dlg.querySelectorAll(".buttonPremiereInfo"), i = 0, length = btnPurchases.length; i < length; i++) btnPurchases[i].addEventListener("click", showExternalPremiereInfo);
        isCurrentDialogRejected = !0;
        var resolveWithTimeLimit = !1,
            btnPlayMinute = dlg.querySelector(".btnPlayMinute");
        btnPlayMinute && btnPlayMinute.addEventListener("click", function() {
            resolveWithTimeLimit = !0, isCurrentDialogRejected = !1, dialogHelper.close(dlg)
        }), dlg.querySelector(".btnRestorePurchase").addEventListener("click", function() {
            restorePurchase(unlockableProductInfo)
        }), loading.hide();
        var btnCloseDialogs = dlg.querySelectorAll(".btnCloseDialog");
        for (i = 0, length = btnCloseDialogs.length; i < length; i++) btnCloseDialogs[i].addEventListener("click", onCloseButtonClick);
        dlg.classList.add("inAppPurchaseOverlay"), layoutManager.tv && centerFocus(dlg.querySelector(".formDialogContent"), !1, !0), dialogHelper.open(dlg).then(function() {
            layoutManager.tv && centerFocus(dlg.querySelector(".formDialogContent"), !1, !1);
            var rejected = isCurrentDialogRejected;
            clearCurrentDisplayingInfo(), rejected ? reject() : resolveWithTimeLimit && resolve({
                enableTimeLimit: !0
            })
        })
    }

    function getSubscriptionBenefits() {
        var list = [];
        return list.push({
            name: globalize.translate("sharedcomponents#HeaderFreeApps"),
            icon: "&#xE5CA;",
            text: globalize.translate("sharedcomponents#FreeAppsFeatureDescription")
        }), appHost.supports("sync") && list.push({
            name: globalize.translate("sharedcomponents#HeaderOfflineDownloads"),
            icon: "&#xE2C4;",
            text: globalize.translate("sharedcomponents#HeaderOfflineDownloadsDescription")
        }), list.push({
            name: globalize.translate("sharedcomponents#LiveTV"),
            icon: "&#xE639;",
            text: globalize.translate("sharedcomponents#LiveTvFeatureDescription")
        }), list.push({
            name: "Jellyfin DVR",
            icon: "&#xE1B2;",
            text: globalize.translate("sharedcomponents#DvrFeatureDescription")
        }), list.push({
            name: globalize.translate("sharedcomponents#HeaderCinemaMode"),
            icon: "&#xE02C;",
            text: globalize.translate("sharedcomponents#CinemaModeFeatureDescription")
        }), list.push({
            name: globalize.translate("sharedcomponents#HeaderCloudSync"),
            icon: "&#xE627;",
            text: globalize.translate("sharedcomponents#CloudSyncFeatureDescription")
        }), list
    }

    function getSubscriptionBenefitHtml(item) {
        var enableLink = appHost.supports("externalpremium"),
            html = "",
            cssClass = "listItem";
        return layoutManager.tv && (cssClass += " listItem-focusscale"), enableLink ? (cssClass += " listItem-button", html += '<button type="button" class="' + cssClass + ' buttonPremiereInfo">') : html += '<div class="' + cssClass + '">', html += '<i class="listItemIcon md-icon">' + item.icon + "</i>", html += '<div class="listItemBody">', html += '<h3 class="listItemBodyText">', html += item.name, html += "</h3>", html += '<div class="listItemBodyText secondary">', html += item.text, html += "</div>", html += "</div>", html += enableLink ? "</button>" : "</div>"
    }

    function onPurchaseButtonClick() {
        var featureId = this.getAttribute("data-featureid");
        "true" === this.getAttribute("data-email") ? getUserEmail().then(function(email) {
            iapManager.beginPurchase(featureId, email)
        }) : iapManager.beginPurchase(featureId)
    }

    function restorePurchase(unlockableProductInfo) {
        var dlg = dialogHelper.createDialog({
            size: layoutManager.tv ? "fullscreen" : "fullscreen-border",
            removeOnClose: !0,
            scrollY: !1
        });
        dlg.classList.add("formDialog");
        var html = "";
        html += '<div class="formDialogHeader">', html += '<button is="paper-icon-button-light" class="btnCloseDialog autoSize" tabindex="-1"><i class="md-icon">&#xE5C4;</i></button>', html += '<h3 class="formDialogHeaderTitle">', html += iapManager.getRestoreButtonText(), html += "</h3>", html += "</div>", html += '<div class="formDialogContent smoothScrollY">', html += '<div class="dialogContentInner dialog-content-centered">', html += '<p style="margin:2em 0;">', html += globalize.translate("sharedcomponents#HowDidYouPay"), html += "</p>", html += "<p>", html += '<button is="emby-button" type="button" class="raised button-cancel block btnRestoreSub"><span>' + globalize.translate("sharedcomponents#IHaveJellyfinPremiere") + "</span></button>", html += "</p>", unlockableProductInfo && (html += "<p>", html += '<button is="emby-button" type="button" class="raised button-cancel block btnRestoreUnlock"><span>' + globalize.translate("sharedcomponents#IPurchasedThisApp") + "</span></button>", html += "</p>"), html += "</div>", html += "</div>", dlg.innerHTML = html, document.body.appendChild(dlg), loading.hide(), layoutManager.tv && centerFocus(dlg.querySelector(".formDialogContent"), !1, !0), dlg.querySelector(".btnCloseDialog").addEventListener("click", function() {
            dialogHelper.close(dlg)
        }), dlg.querySelector(".btnRestoreSub").addEventListener("click", function() {
            dialogHelper.close(dlg), alertText({
                text: globalize.translate("sharedcomponents#MessageToValidateSupporter"),
                title: "Jellyfin Premiere"
            })
        });
        var btnRestoreUnlock = dlg.querySelector(".btnRestoreUnlock");
        btnRestoreUnlock && btnRestoreUnlock.addEventListener("click", function() {
            dialogHelper.close(dlg), iapManager.restorePurchase()
        }), dialogHelper.open(dlg).then(function() {
            layoutManager.tv && centerFocus(dlg.querySelector(".formDialogContent"), !1, !1)
        })
    }

    function getUserEmail() {
        if (connectionManager.isLoggedIntoConnect()) {
            var connectUser = connectionManager.connectUser();
            if (connectUser && connectUser.Email) return Promise.resolve(connectUser.Email)
        }
        return new Promise(function(resolve, reject) {
            require(["prompt"], function(prompt) {
                prompt({
                    label: globalize.translate("sharedcomponents#LabelEmailAddress")
                }).then(resolve, reject)
            })
        })
    }

    function onProductUpdated(e, product) {
        if (product.owned) {
            var resolve = currentDisplayingResolve;
            if (resolve && currentDisplayingProductInfos.filter(function(p) {
                    return product.id === p.id
                }).length) return isCurrentDialogRejected = !1, cancelInAppPurchase(), void resolve()
        }
        var feature = currentValidatingFeature;
        feature && iapManager.isUnlockedByDefault(feature).then(function() {
            isCurrentDialogRejected = !1, cancelInAppPurchase(), resolve()
        })
    }

    function showPremiereInfo() {
        return appHost.supports("externalpremium") ? (showExternalPremiereInfo(), Promise.resolve()) : iapManager.getSubscriptionOptions().then(function(subscriptionOptions) {
            return showInAppPurchaseInfo(subscriptionOptions, null, {
                title: "Jellyfin Premiere",
                feature: "sync"
            })
        })
    }
    var currentDisplayingProductInfos = [],
        currentDisplayingResolve = null,
        currentValidatingFeature = null,
        isCurrentDialogRejected = null;
    return events.on(iapManager, "productupdated", onProductUpdated), {
        validateFeature: validateFeature,
        showPremiereInfo: showPremiereInfo
    }
});
