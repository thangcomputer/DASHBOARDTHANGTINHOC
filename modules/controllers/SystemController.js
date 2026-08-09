const systemApplicationService = require('../services/SystemApplicationService');

class SystemController {
  async get_bank1(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.get_bank1(data);
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
  async getRoot2(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.getRoot2(data);
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
  async putRoot3(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.putRoot3(data);
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
  async post_upload_popup_image4(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.post_upload_popup_image4(data);
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
  async post_upload_invoice_signature5(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.post_upload_invoice_signature5(data);
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
  async get_popup6(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.get_popup6(data);
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
  async get_payment7(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.get_payment7(data);
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
  async get_web8(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.get_web8(data);
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
  async put_web9(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.put_web9(data);
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
  async get_training_data10(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.get_training_data10(data);
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
  async put_training_data11(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.put_training_data11(data);
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
  async get_student_training_data12(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.get_student_training_data12(data);
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
  async put_student_training_data13(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.put_student_training_data13(data);
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
  async get_student_exam_config14(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.get_student_exam_config14(data);
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
  async get_teacher_exam_config15(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.get_teacher_exam_config15(data);
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
  async put_teacher_exam_config16(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.put_teacher_exam_config16(data);
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
  async get_exam_subjects17(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.get_exam_subjects17(data);
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
  async post_exam_subjects18(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.post_exam_subjects18(data);
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
  async delete_exam_subjects_id19(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.delete_exam_subjects_id19(data);
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
  async put_student_exam_config20(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.put_student_exam_config20(data);
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
  async post_upload_logo21(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.post_upload_logo21(data);
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
  async post_upload_favicon22(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.post_upload_favicon22(data);
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
  async post_upload_invoice_logo23(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.post_upload_invoice_logo23(data);
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
  async post_reset_data24(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await systemApplicationService.post_reset_data24(data);
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

module.exports = new SystemController();
