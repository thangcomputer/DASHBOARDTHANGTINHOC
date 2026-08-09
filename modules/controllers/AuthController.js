const authApplicationService = require('../services/AuthApplicationService');

class AuthController {
  async post_refresh1(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_refresh1(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_check_role2(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_check_role2(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async get_zalo_callback3(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.get_zalo_callback3(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_login4(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_login4(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_login_public5(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_login_public5(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_login_internal6(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_login_internal6(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_mfa_verify7(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_mfa_verify7(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_mfa_setup8(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_mfa_setup8(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_mfa_enable9(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_mfa_enable9(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_mfa_disable10(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_mfa_disable10(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async get_mfa_status11(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.get_mfa_status11(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_logout12(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_logout12(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_register_teacher13(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_register_teacher13(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_change_password14(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_change_password14(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async get_me15(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.get_me15(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_avatar16(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_avatar16(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_forgot_password_request17(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_forgot_password_request17(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_forgot_password_verify18(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_forgot_password_verify18(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_admin_generate_otp19(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_admin_generate_otp19(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_reset_password_request20(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_reset_password_request20(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async post_admin_reset_password21(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.post_admin_reset_password21(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  async put_admin_profile22(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await authApplicationService.put_admin_profile22(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new AuthController();
