<?php
/**
 * Plugin Name: LUVEX UV Strip Analyzer
 * Description: WordPress integration for LUVEX UV Strip Analyzer with user authentication
 * Version: 1.0.0
 * Author: LUVEX Team
 */

if (!defined('ABSPATH')) exit;

class LuvexUVStripAnalyzer {

    private $jwt_secret;

    public function __construct() {
        $this->jwt_secret = $this->get_jwt_secret();
        add_action('init', array($this, 'init'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_shortcode('luvex_uvstrip_analyzer', array($this, 'analyzer_shortcode'));
        add_action('wp_ajax_luvex_uvstrip_get_token', array($this, 'ajax_get_token'));
        add_action('wp_ajax_nopriv_luvex_uvstrip_get_token', array($this, 'ajax_get_token_denied'));
        register_activation_hook(__FILE__, array($this, 'activate'));
    }

    public function init() {}

    private function get_jwt_secret() {
        $secret = get_option('luvex_uvstrip_jwt_secret');
        if (!$secret) {
            $secret = bin2hex(random_bytes(32));
            update_option('luvex_uvstrip_jwt_secret', $secret);
        }
        return $secret;
    }

    public function add_admin_menu() {
        add_options_page('LUVEX UV Strip Analyzer', 'UV Strip Analyzer', 'manage_options', 'luvex-uvstrip-analyzer', array($this, 'admin_page'));
    }

    public function admin_page() {
        if (isset($_POST['submit'])) {
            update_option('luvex_uvstrip_analyzer_url', sanitize_url($_POST['analyzer_url']));
            echo '<div class="notice notice-success"><p>Einstellungen gespeichert!</p></div>';
        }

        $analyzer_url = get_option('luvex_uvstrip_analyzer_url', 'https://analyzer.luvex.tech');
        ?>
        <div class="wrap">
            <h1>LUVEX UV Strip Analyzer</h1>
            <form method="post">
                <table class="form-table">
                    <tr>
                        <th>Analyzer URL</th>
                        <td>
                            <input type="url" name="analyzer_url" value="<?php echo esc_attr($analyzer_url); ?>" class="regular-text" />
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
            <hr>
            <h3>Verwendung</h3>
            <p>Shortcode: <code>[luvex_uvstrip_analyzer]</code></p>
            <p>JWT Secret: <code><?php echo esc_html(substr($this->jwt_secret, 0, 16) . '...'); ?></code></p>
        </div>
        <?php
    }

        public function analyzer_shortcode($atts) {
            if (!is_user_logged_in()) {
                return '<div class="luvex-login-required"><p>🔒 Anmeldung erforderlich für den UV Strip Analyzer.</p><a href="' . wp_login_url(get_permalink()) . '" class="button">Anmelden</a></div>';
            }

            $analyzer_url = get_option('luvex_uvstrip_analyzer_url', 'https://analyzer.luvex.tech');
            $container_id = 'luvex-uvstrip-' . uniqid();

            ob_start();
            ?>
            <div id="<?php echo $container_id; ?>" style="display: none;"></div>

            <script>
            (function() {
                fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    credentials: 'same-origin',
                    body: 'action=luvex_uvstrip_get_token&_wpnonce=<?php echo wp_create_nonce('luvex_uvstrip_token'); ?>'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.data && data.data.token) {    
                        sessionStorage.setItem('luvex_uvstrip_auth_token', data.data.token);
                        
                        // Den Parent-Container (quick-action-card) klickbar machen
                        const parentCard = document.getElementById('<?php echo $container_id; ?>').closest('.quick-action-card');
                        if (parentCard) {
                            parentCard.style.cursor = 'pointer';
                            parentCard.onclick = function() {
                            const token = sessionStorage.getItem('luvex_uvstrip_auth_token');
                            const url = '<?php echo esc_js($analyzer_url); ?>' + (token ? '?token=' + encodeURIComponent(token) : '');
                            window.open(url, '_blank');
                        };
                        }
                    } else {
                        document.getElementById('<?php echo $container_id; ?>').innerHTML =
                            '<div style="padding:20px; color:red;">Authentifizierung fehlgeschlagen</div>';
                        document.getElementById('<?php echo $container_id; ?>').style.display = 'block';
                    }
                });
            })();
            </script>
            <?php
            return ob_get_clean();
        }


            public function ajax_get_token() {
            // CORS Headers hinzufügen
            $this->add_cors_headers();
            
            // Debug Logging
            error_log('UV Strip Token Request from: ' . ($_SERVER['HTTP_ORIGIN'] ?? 'no-origin'));
            error_log('User logged in: ' . (is_user_logged_in() ? 'Yes' : 'No'));
            
            if (!is_user_logged_in()) {
                error_log('UV Strip: User not logged in');
                wp_send_json_error(array('message' => 'Not logged in'));
            }

            $token = $this->generate_jwt_token();
            if ($token) {
                error_log('UV Strip: Token generated successfully');
                wp_send_json_success(array(
                    'token' => $token,
                    'user' => array(
                        'id' => get_current_user_id(),
                        'display_name' => wp_get_current_user()->display_name
                    )
                ));
            } else {
                error_log('UV Strip: Token generation failed');
                wp_send_json_error(array('message' => 'Token generation failed'));
            }
        }

    public function ajax_get_token_denied() {
        wp_send_json_error(array('message' => 'Access denied'));
    }

    private function generate_jwt_token() {
        if (!is_user_logged_in()) return false;

        $user = wp_get_current_user();
        $payload = array(
            'user_id' => $user->ID,
            'username' => $user->user_login,
            'email' => $user->user_email,
            'display_name' => $user->display_name,
            'aud' => 'luvex-uvstrip-analyzer',
            'iat' => time(),
            'exp' => time() + (2 * 60 * 60),
            'iss' => get_site_url(),
        );

        return $this->jwt_encode($payload, $this->jwt_secret);
    }

    private function jwt_encode($payload, $secret) {
        $header = json_encode(array('typ' => 'JWT', 'alg' => 'HS256'));
        $payload = json_encode($payload);

        $header_encoded = $this->base64url_encode($header);
        $payload_encoded = $this->base64url_encode($payload);

        $signature = hash_hmac('sha256', $header_encoded . '.' . $payload_encoded, $secret, true);
        $signature_encoded = $this->base64url_encode($signature);

        return $header_encoded . '.' . $payload_encoded . '.' . $signature_encoded;
    }

    private function base64url_encode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    public function activate() {
        add_option('luvex_uvstrip_analyzer_url', 'https://analyzer.luvex.tech');
        $this->get_jwt_secret();
    }





    private function add_cors_headers() {
        $allowed_origins = [
            'https://analyzer.luvex.tech',
            'https://www.luvex.tech',
            'https://luvex.tech'
        ];
        
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        
        if (in_array($origin, $allowed_origins)) {
            header("Access-Control-Allow-Origin: $origin");
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization');
            
            error_log('UV Strip: CORS headers set for origin: ' . $origin);
        } else {
            error_log('UV Strip: Origin not allowed: ' . $origin);
        }
        
        // Handle OPTIONS preflight request
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }
} // ← Klassen-Ende

new LuvexUVStripAnalyzer();

?>
