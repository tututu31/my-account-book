package crc649216dd702e564ebf;


public class MyNotificationListener
	extends android.service.notification.NotificationListenerService
	implements
		mono.android.IGCUserPeer
{
/** @hide */
	public static final String __md_methods;
	static {
		__md_methods = 
			"n_onNotificationPosted:(Landroid/service/notification/StatusBarNotification;)V:GetOnNotificationPosted_Landroid_service_notification_StatusBarNotification_Handler\n" +
			"n_onNotificationRemoved:(Landroid/service/notification/StatusBarNotification;)V:GetOnNotificationRemoved_Landroid_service_notification_StatusBarNotification_Handler\n" +
			"";
		mono.android.Runtime.register ("LedgerBot.MyNotificationListener, LedgerBot", MyNotificationListener.class, __md_methods);
	}

	public MyNotificationListener ()
	{
		super ();
		if (getClass () == MyNotificationListener.class) {
			mono.android.TypeManager.Activate ("LedgerBot.MyNotificationListener, LedgerBot", "", this, new java.lang.Object[] {  });
		}
	}

	public void onNotificationPosted (android.service.notification.StatusBarNotification p0)
	{
		n_onNotificationPosted (p0);
	}

	private native void n_onNotificationPosted (android.service.notification.StatusBarNotification p0);

	public void onNotificationRemoved (android.service.notification.StatusBarNotification p0)
	{
		n_onNotificationRemoved (p0);
	}

	private native void n_onNotificationRemoved (android.service.notification.StatusBarNotification p0);

	private java.util.ArrayList refList;
	public void monodroidAddReference (java.lang.Object obj)
	{
		if (refList == null)
			refList = new java.util.ArrayList ();
		refList.add (obj);
	}

	public void monodroidClearReferences ()
	{
		if (refList != null)
			refList.clear ();
	}
}
