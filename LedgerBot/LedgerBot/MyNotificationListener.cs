using Android.App;
using Android.Content;
using Android.OS;
using Android.Service.Notification;
using Android.Util;

namespace LedgerBot
{
    [Service(Label = "가계부 알림봇", Permission = "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE", Exported = true)]
    [IntentFilter(new[] { "android.service.notification.NotificationListenerService" })]
    public class MyNotificationListener : NotificationListenerService
    {
        const string TAG = "LedgerBot";

        public override void OnNotificationPosted(StatusBarNotification sbn)
        {
            base.OnNotificationPosted(sbn);

            string packageName = sbn.PackageName;
            Bundle extras = sbn.Notification.Extras;

            string title = extras.GetString("android.title") ?? "제목없음";
            string text = extras.GetCharSequence("android.text")?.ToString() ?? "내용없음";

            Log.Debug(TAG, $"새 알림 도착! 앱: {packageName} | 제목: {title} | 내용: {text}");
        }

        public override void OnNotificationRemoved(StatusBarNotification sbn)
        {
            base.OnNotificationRemoved(sbn);
            Log.Debug(TAG, $"알림 삭제: {sbn.PackageName}");
        }
    }
}
