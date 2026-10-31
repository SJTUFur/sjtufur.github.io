{{- $posts := slice -}}
{{- range first 3 (where .Site.RegularPages "Section" "announcements").ByDate.Reverse -}}
  {{- $posts = $posts | append (dict "title" .Title "date" (.Date.Format "2006-01-02") "summary" (.Summary | plainify) "url" .RelPermalink) -}}
{{- end -}}
window.SITE_ACTIVITY = {{ $posts | jsonify | safeJS }};
