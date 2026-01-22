// routes/api/v1/index

const express         = require('express');
const router          = express.Router();
const axios           = require("axios");
var bcrypt            = require('bcrypt');

const dotenv = require('dotenv');

dotenv.config();

//MySQL

var SQL = require('../../../../storage/database');

// Create an instance of SQL
const db = new SQL();

class auth {
  constructor() {}

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Query the database to find the user
      db.secureQuery('SELECT * FROM users WHERE email = ?', [email], (result) => {
        if (result.length === 0) {
          return res.redirect('/auth/login?error=userNotFound');
        }

        const user = result[0];

        // Verify reCAPTCHA using axios
        const recaptchaUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${req.body['g-recaptcha-response']}&remoteip=${req.ip}`;

        axios.post(recaptchaUrl)
          .then(response => {
            const body = response.data;

            if (!body.success) {
              return res.redirect('/auth/login?fail=true');
            }

            // Compare password after reCAPTCHA verification
            bcrypt.compare(password, user.password, function (err, passwordMatch) {
              if (err) return res.status(500).json({ message: 'Password verification failed' });

              if (!passwordMatch) {
                return res.redirect('/auth/login?error=invalidCredentials');
              }

              ////



              // when we login we need to move the guest cart items over to the logged in account so the client does not loose their cart.

              const session_id = req.session.sessionID;

              // Step 1: Get the guest cart
              db.secureQuery('SELECT * FROM carts WHERE session_id = ? LIMIT 1', [session_id], (cartResult) => {

                console.log(req.body);

                if (cartResult.length > 0) {
                  const guestCart = cartResult[0];
              
                  // Step 2: Update the cart to assign it to the logged-in user
                  db.secureQuery(
                    'UPDATE carts SET user_id = ? WHERE id = ?',
                    [user.id, guestCart.id],
                    (updateResult) => {
                    
                      // Final step: redirect to account
                      req.session.user = {
                        id: user.id,
                        email: user.email,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        company: user.company
                      };

                      req.session.save();

                      if(req.body.redirect_uri) return res.redirect(`${req.body.redirect_uri}`);
                      else res.redirect('/account?login=true');
                    }
                  );
                } else {
                  // No guest cart found, just continue with login
                  req.session.user = {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    company: user.company
                  };
              
                  req.session.save();

                  if(req.body.redirect_uri) return res.redirect(`${req.body.redirect_uri}`);
                  else res.redirect('/account?login=true');
                }
              });

            });
          })
          .catch(error => {
            console.error('reCAPTCHA verification error:', error);
            return res.status(500).json({ message: 'reCAPTCHA verification failed' });
          });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new auth();


const authClass = new auth();

router.post('/', (req, res) => authClass.login(req, res));
module.exports = router;