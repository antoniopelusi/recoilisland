.PHONY: run
.SILENT: run

run:
	echo "+---------------------------------------+"
	echo "| Local:   http://localhost:8000\t|"
	echo "| Network: http://$$(hostname -I | awk '{print $$1}'):8000\t|"
	echo "+---------------------------------------+"
	python3 -m http.server 8000 --bind 0.0.0.0
