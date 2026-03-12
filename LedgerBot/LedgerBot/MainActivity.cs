using Android.App;
using Android.Content;
using Android.OS;
using Android.Webkit;
using Android.Provider;
using Android.Widget;
using System.Linq;

namespace LedgerBot
{
    [Activity(Label = "@string/app_name", MainLauncher = true)]
    public class MainActivity : Activity
    {
        WebView webView;

        protected override void OnCreate(Bundle? savedInstanceState)
        {
            base.OnCreate(savedInstanceState);
            SetContentView(Resource.Layout.activity_main);

            webView = FindViewById<WebView>(Resource.Id.webView);

            // 알림 접근 권한이 없으면 권한 설정 화면으로 이동
            if (!IsNotificationServiceEnabled())
            {
                Toast.MakeText(this, "알림 접근 권한을 허용해주세요.", ToastLength.Long).Show();
                StartActivity(new Intent(Settings.ActionNotificationListenerSettings));
            }

            SetupWebView();
        }

        private void SetupWebView()
        {
            webView.Settings.JavaScriptEnabled = true;
            webView.Settings.DomStorageEnabled = true; // localStorage 지원
            
            // WebViewChromeClient 설정 (alert, confirm 등 브라우저 기본 팝업 지원)
            webView.SetWebChromeClient(new WebChromeClient());
            webView.SetWebViewClient(new WebViewClient());

            // 로컬 파일 경로 구성 (현재는 Asset이나 하드코딩된 서버 경로 사용 가능하지만
            // 데스크탑 파일시스템 접근은 앱 권한으로 불가능하므로 우선 로컬 파일 템플릿 로드)
            webView.LoadUrl("file:///android_asset/index.html");
        }

        private bool IsNotificationServiceEnabled()
        {
            string packageName = PackageName;
            string flat = Settings.Secure.GetString(ContentResolver, "enabled_notification_listeners");
            if (!string.IsNullOrEmpty(flat))
            {
                var names = flat.Split(':');
                foreach (var name in names)
                {
                    var componentName = ComponentName.UnflattenFromString(name);
                    if (componentName != null && componentName.PackageName == packageName)
                    {
                        return true;
                    }
                }
            }
            return false;
        }
    }
}