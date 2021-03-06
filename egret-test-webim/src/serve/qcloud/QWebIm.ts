/** 云通信webim
 *  class QWebImMsg 消息结构
 *  interface IQWebImMsg 消息结构
 *  class QWebImType 消息类型
 *  QWebImEvent 响应事件
 *  interface IQwebImUser 用户数据
 *
 *  init 初始化QWebIm
 */
class QWebIm extends egret.EventDispatcher {
    private static _instance:QWebIm;
    public static i():QWebIm {
        if (!this._instance) this._instance = new QWebIm();
        return this._instance;
    }


    //帐号模式，0-表示独立模式，1-表示托管模式
    private accountMode = 0;
    private avChatRoomId = ''; //默认房间群ID
    private selType:string;
    private selToID = ''; //当前选中聊天id（当聊天类型为私聊时，该值为好友帐号，否则为群号）
    private selSess = null; //当前聊天会话
    //默认群组头像(选填)
    private selSessHeadUrl = '';

    //当前用户身份
    public loginInfo:webim.LoginInfo = {
        "sdkAppID": "", //用户标识接入SDK的应用ID，必填
        "appIDAt3rd": "", //App用户使用OAuth授权体系分配的Appid，和sdkAppID一样，必填
        "identifier": "", //用户帐号，必填
        "accountType": 0, //用户所属应用帐号类型，必填
        "userSig": "", //当前用户身份凭证，必须是字符串类型，必填
        "identifierNick": "", //当前用户昵称，不用填写，登录接口会返回用户的昵称，如果没有设置，则返回用户的id
        "portrait": '' //当前用户默认头像，选填，如果设置过头像，则可以通过拉取个人资料接口来得到头像信息
    };
    //监听（多终端同步）群系统消息方法，方法都定义在demo_group_notice.js文件中
    //注意每个数字代表的含义，比如，
    //1表示监听申请加群消息，2表示监听申请加群被同意消息，3表示监听申请加群被拒绝消息等
    private onGroupSystemNotifys = {
        "5": this.onDestoryGroupNotify, //群被解散(全员接收)
        "11": this.onRevokeGroupNotify, //群已被回收(全员接收)
        "255": this.onCustomGroupNotify //用户自定义通知(默认全员接收)
    };

    private options = {
        "isAccessFormalEnv": true, //是否访问正式环境，默认访问正式，选填
        "isLogOn": false //是否在浏览器控制台打印sdk日志
    }
    //监听事件
    private listeners = {
        "jsonpCallback": this.jsonpCallback.bind(this) //IE9(含)以下浏览器用到的jsonp回调函数,移动端可不填，pc端必填
                ,
        "onMsgNotify": this.onMsgNotify.bind(this) //监听新消息(私聊(包括普通消息和全员推送消息)，普通群(非直播聊天室)消息)事件
                ,
        "onBigGroupMsgNotify": this.onBigGroupMsgNotify.bind(this) //监听新消息(直播聊天室)事件，直播场景下必填
                ,
        "onGroupInfoChangeNotify": this.onGroupInfoChangeNotify.bind(this) //监听群资料变化事件，选填
                ,
        "onGroupSystemNotifys": this.onGroupSystemNotifys //监听（多终端同步）群系统消息事件，必填
                ,
        "onProfileSystemNotifys": this.onProfileModifyNotify.bind(this) //监听资料系统（自己或好友）通知事件，选填
    };

    /**
     * _avChatRoomId:string 聊天组id
     * _loginInfo:webim.LoginInfo 用户注册信息
     */
    public init(_avChatRoomId:string, _loginInfo:webim.LoginInfo ): void {
        console.log("webim init:", _avChatRoomId, _loginInfo);

        this.avChatRoomId = _avChatRoomId;
        this.selToID = this.avChatRoomId;
        this.selType = webim.SESSION_TYPE.GROUP; //群聊

        this.loginInfo =_loginInfo;


        if (this.accountMode == 1) { //托管模式

        } else { //独立模式
            console.log("独立模式");
            this.sdkLogin();
        }
    };

/** 登录 start ************************************************************************************/
    //sdk登录
    public sdkLogin() {
        // console.log("sdkLogin : ", this.loginInfo)
        //web sdk 登录
        webim.login(this.loginInfo, this.listeners, this.options,
            (resp) => {
                console.log("webim登录成功:", resp);
                //identifierNick为登录用户昵称(没有设置时，为帐号)，无登录态时为空
                this.loginInfo.identifierNick = resp.identifierNick; //设置当前用户昵称
                // webim.Log.info('webim登录成功');
                this.applyJoinBigGroup(); //加入大群
            },
            (err) => {
                console.log(err);
            }
        );
    }

    //进入大群
    public applyJoinBigGroup() {
        let options = {
            'GroupId': this.avChatRoomId //群id
        };
        webim.applyJoinBigGroup(options,
            (resp) => {
                //JoinedSuccess:加入成功; WaitAdminApproval:等待管理员审批
                if (resp.JoinedStatus && resp.JoinedStatus == 'JoinedSuccess') {
                    console.log("进群成功", resp);
                    // webim.Log.info('进群成功');
                    this.selToID = this.avChatRoomId;

                    let ime:QWebImEvent = new QWebImEvent(QWebImEvent.APPLYJOINBIGGROUPEVENT);
                    this.dispatchEvent(ime);
                } else {
                    console.log('进群失败');
                }
            },
            (err) => {
                console.log("applyJoinBigGroup error:", err);
                if (err.ErrorCode == 10013) {
                    let ime:QWebImEvent = new QWebImEvent(QWebImEvent.APPLYJOINBIGGROUPEVENT);
                    this.dispatchEvent(ime);
                }
            }
        );
    }
    /** 退出大群 */
    public quitBigGroup() {
        let options = {
            'GroupId': this.avChatRoomId //群id
        };
        webim.quitBigGroup(
            options,
            (resp) => {
                webim.Log.info('退群成功');
                this.logout();
            },
            (err) => {
                console.log(err);
            }
        );
    }

    /** 登出 */
    public logout() {
        webim.logout(
            (resp) => {
                webim.Log.info('登出成功');
                this.loginInfo.identifier = null;
                this.loginInfo.userSig = null;
            },
            (err) =>  {
                console.log(err);
            }
        );
    }
/** 登录 end **********************************************************************************/


/** 接收信息 start ****************************************************************************/
    //IE9(含)以下浏览器用到的jsonp回调函数
    public jsonpCallback(rspData) {
        //设置接口返回的数据
        webim.setJsonpLastRspData(rspData);
    }
    public onGroupInfoChangeNotify(newNotify) {
        console.log("onGroupInfoChangeNotify:", newNotify);
    }
    //监听新消息(私聊(包括普通消息、全员推送消息)，普通群(非直播聊天室)消息)事件
    public onMsgNotify(newMsgList) {
        // console.log("onMsgNotify:", newMsgList);
        let newMsg;
        for (let j in newMsgList) { //遍历新消息
            newMsg = newMsgList[j];
            this.handlderMsg(newMsg); //处理新消息
        }
    }
    public onBigGroupMsgNotify(newMsgList) {
        console.log("onBigGroupMsgNotify:", newMsgList);
    }
    public onProfileModifyNotify(notify) {
        console.log("onProfileModifyNotify:", notify);
    }


    //处理消息（私聊(包括普通消息和全员推送消息)，普通群(非直播聊天室)消息）
    public handlderMsg(msg) {
        // console.log("handlderMsg:", msg);

        /** 获取会话类型
         * webim.SESSION_TYPE.GROUP-群聊，
         * webim.SESSION_TYPE.C2C-私聊，
         */
        let sessType = msg.getSession().type();
        /** 获取消息子类型
         * 会话类型为群聊时，子类型为：webim.GROUP_MSG_SUB_TYPE
         * 会话类型为私聊时，子类型为：webim.C2C_MSG_SUB_TYPE
         */
        let subType = msg.getSubType();

        let ime:QWebImEvent;
        switch (sessType) {
            case webim.SESSION_TYPE.C2C: //私聊消息
                console.log("私聊消息....", msg);
                ime = new QWebImEvent(QWebImEvent.ADDMSGPRIVATEEVENT);
                break;
            case webim.SESSION_TYPE.GROUP: //普通群消息，对于直播聊天室场景，不需要作处理
                console.log("普通群新消息:", msg, sessType, subType);
                ime = new QWebImEvent(QWebImEvent.ADDMSGGROUPEVENT);
                break;
        }
        ime.msgList = this.parseMsg(msg);
        this.dispatchEvent(ime);
    }
    public parseMsg(msg:webim.Msg):QWebImMsg[] {
        let _itemlist:QWebImMsg[] = [];
        let _els = msg.getElems();
        for (let i=0; i<_els.length; i++) {
            let _el:webim.Msg.Elem = _els[i];
            let type = _el.getType();//获取元素类型
            let content = _el.getContent();//获取元素对象
            // console.log(_el);
            if (type == webim.MSG_ELEMENT_TYPE.CUSTOM) {
                let data:IQWebImMsg = JSON.parse(content.getData());
                data.sendTime = msg.getTime();
                let _item:QWebImMsg = new QWebImMsg(data);
                // _item.sender.userId = Number(msg.getFromAccount());
                // _item.sender.nickname = msg.getFromAccountNick();
                // _item.sendTime = msg.getTime();
                // _item.client = data.client;
                _item.isSend = msg.getIsSend();
                _itemlist.push(_item);
            }
        }
        return _itemlist;
    }
/** 接收信息 end ****************************************************************************/


/** 功能 start **********************************************************************************/
    /** 发送消息(普通消息)
     *  sdfsdf
     */
    public onSendMsg(imMsg:IQWebImMsg, cbOk?, cbErr?) {
        if (!this.loginInfo.identifier) { //未登录
            if (this.accountMode == 0) { //独立模式
                this.sdkLogin();
            }
            return;
        }
        if (!this.selSess) {
            this.selSess = new webim.Session(this.selType, this.selToID, this.selToID, this.selSessHeadUrl, Math.round(new Date().getTime() / 1000));
        }
        let isSend = true; //是否为自己发送
        let seq = -1; //消息序列，-1表示sdk自动生成，用于去重
        let random = Math.round(Math.random() * 4294967296); //消息随机数，用于去重
        let msgTime = Math.round(new Date().getTime() / 1000); //消息时间戳
        let subType; //消息子类型
        if (this.selType == webim.SESSION_TYPE.GROUP) {
            subType = webim.GROUP_MSG_SUB_TYPE.COMMON;
        } else {
            subType = webim.C2C_MSG_SUB_TYPE.COMMON;
        }
        console.log("发送消息：", imMsg)
        let msg = new webim.Msg(this.selSess, isSend, seq, random, msgTime, this.loginInfo.identifier, subType, this.loginInfo.identifierNick);

        let customObj = new webim.Msg.Elem.Custom(JSON.stringify(imMsg), "", "");
        msg.addCustom(customObj);
        webim.sendMsg(msg, function (resp) {
            console.log("发消息成功:", resp);
            // webim.Log.info("发消息成功");
            return cbOk && cbOk(resp);
        }, function (err) {
            console.log("发消息失败:", err);
            // webim.Log.error("发消息失败:" + err.ErrorInfo);
            return cbErr && cbErr(err);
        });
    }


    public getGroupMemberPortrait():Promise<{}> {
        return this.getAccountGroupMemberList().then(this.getProfilePortrait);
    }
    public getAccountGroupMemberList(): Promise<{}> {
        let option = {
            "GroupId": this.avChatRoomId,
            "MemberInfoFilter": [
                "Role",
                "JoinTime",
                "Member_Account",
                "NameCard"
            ]
        }
        return new Promise((resolve, reject) => {
            webim.getGroupMemberInfo(option, (resp) => {
                let _accountlist = [];
                for (let i=0; i<resp["MemberList"].length; i++) {
                    let _obj = resp["MemberList"][i];
                    _accountlist.push(_obj["Member_Account"]);
                }
                resolve(_accountlist);
            }, (err) => {
                reject(err);
            })
        });
    }

    /**
     * return IQWebImUser[]
     */
    public getProfilePortrait(_accountlist): Promise<{}> {
        let tag_list = [
            "Tag_Profile_IM_Nick",//昵称
            "Tag_Profile_IM_Gender",//性别
            "Tag_Profile_IM_Image"//头像
        ];
        let options = {
            'To_Account': _accountlist,
            'TagList': tag_list
        };
        return new Promise((resolve, reject) => {
            webim.getProfilePortrait(options, (resp) => {
                let _userlist:IQwebImUser[] = [];
                let _list = resp["UserProfileItem"];
                for (let i=0; i<_list.length; i++) {
                    let _obj = _list[i];
                    let _user:IQwebImUser = {
                        userId: _obj["To_Account"]
                    }
                    for ( let key in _obj["ProfileItem"]) {
                        switch (_obj["ProfileItem"][key].Tag) {
                            case 'Tag_Profile_IM_Nick':
                                _user.nickname = _obj["ProfileItem"][key].Value;
                                break;
                            case 'Tag_Profile_IM_Gender':
                                _user.gender = _obj["ProfileItem"][key].Value;
                                break;
                            case 'Tag_Profile_IM_Image':
                                _user.portrait = _obj["ProfileItem"][key].Value;
                                break;
                        }
                    }
                    _userlist.push(_user);
                }
                resolve(_userlist);
            }, (err) => {
                reject(err);
            })
        })
    }


/** 功能 end **********************************************************************************/


/** 监听 start ************************************************************************************/
    //监听 解散群 系统消息
    public onDestoryGroupNotify(notify) {
        webim.Log.warn("执行 解散群 回调：" + JSON.stringify(notify));
        console.log("执行 解散群 回调：" + JSON.stringify(notify));
        let reportTypeCh = "[群被解散]";
        let content = "群主" + notify.Operator_Account + "已解散该群";
        this.showGroupSystemMsg(notify.ReportType, reportTypeCh, notify.GroupId, notify.GroupName, content, notify.MsgTime);
    }
    //监听 群被回收 系统消息
    public onRevokeGroupNotify(notify) {
        webim.Log.warn("执行 群被回收 回调：" + JSON.stringify(notify));
        console.log("执行 群被回收 回调：" + JSON.stringify(notify));
        let reportTypeCh = "[群被回收]";
        let content = "该群已被回收";
        this.showGroupSystemMsg(notify.ReportType, reportTypeCh, notify.GroupId, notify.GroupName, content, notify.MsgTime);
    }
    //监听 用户自定义 群系统消息
    public onCustomGroupNotify(notify) {
        webim.Log.warn("执行 用户自定义系统消息 回调：" + JSON.stringify(notify));
        console.log("执行 用户自定义系统消息 回调：" + JSON.stringify(notify));
        let reportTypeCh = "[用户自定义系统消息]";
        let content = notify.UserDefinedField; //群自定义消息数据
        this.showGroupSystemMsg(notify.ReportType, reportTypeCh, notify.GroupId, notify.GroupName, content, notify.MsgTime);
    }

    //显示一条群组系统消息
    public showGroupSystemMsg(type, typeCh, group_id, group_name, msg_content, msg_time) {
        let sysMsgStr = "收到一条群系统消息: type=" + type + ", typeCh=" + typeCh + ",群ID=" + group_id + ", 群名称=" + group_name + ", 内容=" + msg_content + ", 时间=" + webim.Tool.formatTimeStamp(msg_time);
        webim.Log.warn(sysMsgStr);
        console.log("showGroupSystemMsg:", sysMsgStr);
        let ime:QWebImEvent = new QWebImEvent(QWebImEvent.SHOWGROUPSYSTEMMSGEVENT);
        ime.str = sysMsgStr;
        this.dispatchEvent(ime);
    }
/** 监听 end ************************************************************************************/
}

/**
 * 消息结构
 */
class QWebImMsg implements IQWebImMsg {
    public sender:IQwebImUser = {
            userId: "",
            nickname: "",
            gender: 0,
            portrait: "",
            level: 0
        };
    public action:string = "";           // 触发该IM消息的动作:http://wiki.oa.okchang.com/doku.php?id=haochang_chunk:im
    public client:string = "web";           // 枚举类型, 当前支持如下枚举类型: android ios server web
    public roomId:number = 0;           // 平台房间Id
    public sendTime:number = 0;         // client 发送消息时间, 单位毫秒
    public minIMVersion:number = 0;     // IM最小兼容版本
    public content:Object;          // 消息内容, hash结构

    public isSend:boolean;

    public constructor(_data?:IQWebImMsg) {
        this.update(_data);
    }

    public update(_data:IQWebImMsg): void {
        if (_data) {
            this.sender = _data.sender;
            this.action = _data.action;
            this.client = _data.client || "web";
            this.roomId = _data.roomId || 0;
            this.sendTime = _data.sendTime || 0;
            this.minIMVersion = _data.minIMVersion || 0;
            this.content = _data.content || null;
        }
    }

}


interface IQWebImMsg {
    sender:IQwebImUser;
    action: string;
    client?:string;
    roomId?:number;
    sendTime?:number;
    minIMVersion?:number;
    content?:Object;
}
/** 发送人
 * 如果服务器发送的IM消息是以用户名义发送，那么sender就包含该用户的信息
 * 如果服务器发送的系统消息(没有用户触发），该结构也会存在，只是每个字段的值都为空。
 */
interface IQwebImUser {
    userId?: string;             // 用户id
    nickname?: string;           // 用户名
    gender?: number;             // 性别 0:未知 1:男 2:女
    portrait?: string;           // 头像
    level?: number;              // 用户等级
}

class QWebImType {
    /** 进入房间 */
    public static ROOM_ENTER:string = "ROOM_ENTER";
    /** 退出房间 */
    public static ROOM_QUIT:string = "ROOM_QUIT";
    /** 聊天 */
    public static MEMBER_CHAT:string = "MEMBER_CHAT";
    /** 私聊 */
    public static CHAT_PRIVATE:string = "CHAT_PRIVATE";

    /** 开始游戏 */
    public static GAME_START: string = "GAME_START";
    /** 结束游戏 */
	public static GAME_FINISHED: string = "GAME_FINISHED";
    /** 加入语音席 */
	public static SEATS_JOIN: string = "SEATS_JOIN";
    /** 离开语音席 */
	public static SEATS_LEAVE: string = "SEATS_LEAVE";
}


class QWebImEvent extends egret.Event {
    constructor(type:string, bubbles:boolean=false, cancelable:boolean=false) {
        super(type, bubbles, cancelable);
    }

    public msgList:QWebImMsg[];
    public msg:QWebImMsg;

    public str:string; //群组系统消息


    /** 收到新消息 */
    public static ADDMSGGROUPEVENT:string = "addMsgGroupEvent";
    /** 私聊消息 */
    public static ADDMSGPRIVATEEVENT:string = "addMsgPrivateEvent";


    /** 加入大群成功 */
    public static APPLYJOINBIGGROUPEVENT:string = "applyJoinBigGroupEvent";
    /** 退出大群 */
    public static QUITBIGGROUPEVENT:string = "quitBigGroupEvent";
    /** 登出 */
    public static LOGOUTEVENT:string = "logoutEvent";

    /** 群组系统消息 */
    public static SHOWGROUPSYSTEMMSGEVENT:string = "showGroupSystemMsgEvent";

}