namespace sec;

entity ZTUSERS {
  key USERID      : String;
      PASSWORD    : String;
      USERNAME    : String;
      ALIAS       : String;
      FIRSTNAME   : String;
      LASTNAME    : String;
      BIRTHDAYDATE: String;
      COMPANYID   : Integer;
      COMPANYNAME : String;
      COMPANYALIAS: String;
      CEDIID      : String;
      EMPLOYEEID  : String;
      EMAIL       : String;
      PHONENUMBER : String;
      EXTENSION   : String;
      DEPARTMENT  : String;
      FUNCTION    : String;
      STREET      : String;
      POSTALCODE  : Integer;
      CITY        : String;
      REGION      : String;
      STATE       : String;
      COUNTRY     : String;
      AVATAR      : String;
      ROLES       : array of {
        ROLEID    : String;
        ROLEIDSAP : String;
      };
      DETAIL_ROW      : Composition of one {
        ACTIVED     : Boolean default true;
        DELETED     : Boolean default false;

        DETAIL_ROW_REG : Composition of many {
            CURRENT  : Boolean;
            REGDATE  : Timestamp;
            REGTIME  : Timestamp;
            REGUSER  : String;
        };
    };
}

entity ZTROLES {
  key ROLEID      : String;
      ROLENAME    : String;
      DESCRIPTION : String;
      PRIVILEGES  : array of {
        PROCESSID : String;
        PRIVILEGEID : array of String;
      };
      DETAIL_ROW      : Composition of one {
        ACTIVED     : Boolean default true;
        DELETED     : Boolean default false;

        DETAIL_ROW_REG : Composition of many {
            CURRENT  : Boolean;
            REGDATE  : Timestamp;
            REGTIME  : Timestamp;
            REGUSER  : String;
        };
    };
}