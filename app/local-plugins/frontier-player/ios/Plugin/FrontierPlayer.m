//
//  FrontierPlayer.m
//  Capacitor plugin registration.
//
//  The CAP_PLUGIN macro is the Objective-C half of registration. It is NOT
//  sufficient on its own: since Capacitor 6 the bridge binds only classes that
//  also conform to CAPBridgedPlugin in Swift. Both halves are present here
//  deliberately — this project has already lost a release cycle to a plugin
//  that compiled, shipped, and was never reachable from JS.
//
//  The two method lists MUST match. The macro below defines `pluginMethods` in
//  an Objective-C category, and a category method replaces the Swift class's
//  own getter at runtime: whatever is missing here is unreachable from JS even
//  though the Swift list names it. setVideoInsets was missing from 4.0.3 to
//  4.3.1, so the picture never moved clear of the interface on a device.
//  `src/player/__tests__/plugin-registration.test.ts` now fails CI on drift.
//

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(FrontierPlayer, "FrontierPlayer",
    CAP_PLUGIN_METHOD(load, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(enqueue, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(play, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(pause, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(skipToNext, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(seek, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setMuted, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(clearQueue, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(enterPiP, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(exitPiP, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(presentRoutePicker, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setRoutePickerFrame, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getState, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setNowPlayingMetadata, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setVideoInsets, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getDiagnostics, CAPPluginReturnPromise);
)
